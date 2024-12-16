import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import axiosRetry from "axios-retry";
import axios from "axios";

import { RepositoryModel } from "../models/repository.model";
import {
  GITHUB_ERROR_INVALID_ORG_ACCESS,
  GITHUB_ERROR_INVALID_TOKEN,
  GITHUB_ERROR_REPO_ACCESS,
  GITHUB_ERROR_REPO_HOOKS,
  GITHUB_ERROR_REPO_NOT_FOUND,
  GITHUB_FETCH_LIMIT,
  GITHUB_RATE_LIMIT_EXCEEDED,
  INTERNAL_ERROR,
} from "../constants";
import { GithubApiUrlHelper } from "../helpers/githubApiUrl.helper";
import { DetailedRepositoryModel } from "../dto/repository.args";

axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
});

export interface GitHubRepo {
  id: number;
  name: string;
  size: number;
  owner: {
    login: string;
  };
  private: boolean;
}

export interface GitHubWebhook {
  name: string;
  active: boolean;
}

@Injectable()
export class ScannerService {
  private logger = new Logger(ScannerService.name);

  /*
   * Improvements
   * 1. add caching at least 1 min, to avoid multiple requests to the same endpoint: https://docs.nestjs.com/techniques/caching
   * 2. add tests
   *
   * */
  async findAll(token: string): Promise<RepositoryModel[]> {
    await this.checkOrgAccess(token);

    try {
      const allReposData = await this.fetchAllPages(
        GithubApiUrlHelper.getReposUrl(),
        token,
      );
      return await Promise.all(
        allReposData.map(async (repo) => ({
          name: repo.name,
          size: repo.size,
          owner: repo.owner.login,
        })),
      );
    } catch (error) {
      if (error.response && error.response.status === 401) {
        throw new UnauthorizedException(GITHUB_ERROR_INVALID_TOKEN);
      }
      this.logger.error(
        `Error while fetching all repos: ${error}, token: ${token}`,
      );
      // send to sentry to investigate issue and handle specific case
      throw new UnauthorizedException(INTERNAL_ERROR);
    }
  }

  async findOne(
    token: string,
    owner: string,
    name: string,
  ): Promise<DetailedRepositoryModel> {
    try {
      const repoData = await this.performGetRequest<GitHubRepo>(
        GithubApiUrlHelper.getRepoUrl(owner, name),
        token,
        GITHUB_ERROR_REPO_ACCESS,
      );
      const [fileInfo, webHooks] = await Promise.all([
        this.getRepositoryFilesInfo(
          GithubApiUrlHelper.getRepoContentsUrl(owner, name),
          token,
        ),
        this.getActiveWebhooks(token, owner, name),
      ]);

      const ymlContent =
        fileInfo.ymlPaths.length > 0
          ? await this.getYamlFileContent(
              token,
              owner,
              name,
              fileInfo.ymlPaths[0],
            )
          : null;

      return {
        name: repoData.name,
        owner: repoData.owner.login,
        size: repoData.size,
        isPrivate: repoData.private,
        fileCount: fileInfo.amount,
        ymlContent,
        activeWebhooks: webHooks,
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error.response.status === 401
      ) {
        throw new UnauthorizedException(GITHUB_ERROR_INVALID_TOKEN);
      }
      if (error.response && error.response.status === 403) {
        throw new UnauthorizedException(GITHUB_ERROR_REPO_ACCESS);
      }
      if (error.response && error.response.status === 404) {
        throw new UnauthorizedException(GITHUB_ERROR_REPO_NOT_FOUND);
      }
      this.logger.error(
        `Error while fetching repository details: ${error}, token: ${token}, owner: ${owner}, name: ${name}`,
      );
      // send to sentry to investigate issue and handle specific case
      throw new UnauthorizedException(INTERNAL_ERROR);
    }
  }

  private async getYamlFileContent(
    token: string,
    owner: string,
    repo: string,
    path?: string,
  ): Promise<string | null> {
    if (!path) {
      return null;
    }
    try {
      const url = GithubApiUrlHelper.getRepoContentsFileUrl(owner, repo, path);
      const { data } = await axios.get(url, this.getAuthHeaders(token));
      if (data && data.content && data.encoding === "base64") {
        return Buffer.from(data.content, "base64").toString("utf-8");
      }
      return null;
    } catch (error) {
      this.logger.error(
        `Error while fetching yaml file content: ${error}, token: ${token}, owner: ${owner}, repo: ${repo}, path: ${path}`,
      );
      return null;
    }
  }

  private async checkOrgAccess(token: string): Promise<void> {
    const url = GithubApiUrlHelper.getOrgsUrl();
    await this.performGetRequest(url, token, GITHUB_ERROR_INVALID_ORG_ACCESS);
  }

  private async getActiveWebhooks(
    token: string,
    owner: string,
    repo: string,
  ): Promise<GitHubWebhook[]> {
    const webhooks = await this.performGetRequest(
      GithubApiUrlHelper.getRepoHooksUrl(owner, repo),
      token,
      GITHUB_ERROR_REPO_HOOKS,
    );
    return webhooks.filter((hook) => hook.active).map(({ name }) => ({ name }));
  }

  private async getRepositoryFilesInfo(
    url: string,
    token: string,
  ): Promise<{ amount: number; ymlPaths: string[] }> {
    let amount = 0;
    let ymlPaths: string[] = [];
    const options = this.getAuthHeaders(token);

    async function processDirectory(dirUrl: string): Promise<void> {
      const { data: contents } = await axios(dirUrl, options);

      const directories = [];

      if (Array.isArray(contents)) {
        for (const item of contents) {
          const isFile = item.type === "file";

          if (isFile) {
            amount += 1;
          }

          if (
            (isFile && item.name.endsWith(".yml")) ||
            item.name.endsWith(".yaml")
          ) {
            ymlPaths.push(item.path);
          }

          if (!isFile) {
            directories.push(item);
          }
        }

        await Promise.all(
          directories.map((dir) => processDirectory(`${url}/${dir.path}`)),
        );
      }
    }

    await processDirectory(url);

    return { amount, ymlPaths };
  }

  private async fetchAllPages(
    url: string,
    token: string,
    limit = GITHUB_FETCH_LIMIT,
  ): Promise<any[]> {
    let results: any[] = [];
    let page = 1;

    while (true) {
      const pagedUrl = `${url}?per_page=${limit}&page=${page}`;
      const { data } = await axios.get(pagedUrl, this.getAuthHeaders(token));
      if (data.length === 0) {
        break;
      }
      results = results.concat(data);
      page++;
    }

    return results;
  }

  private async performGetRequest<T>(
    url: string,
    token: string,
    unauthorizedExceptionMessage: string,
  ): Promise<any> {
    try {
      const { data } = await axios.get(url, this.getAuthHeaders(token));
      return data as T;
    } catch (error) {
      if (error?.response?.data?.message?.includes("rate limit exceeded")) {
        this.logger.debug(error?.response?.data?.message);
        throw new UnauthorizedException(GITHUB_RATE_LIMIT_EXCEEDED);
      }
      if (
        error.response &&
        (error.response.status === 401 || error.response.status === 403)
      ) {
        throw new UnauthorizedException(unauthorizedExceptionMessage);
      }
      throw error;
    }
  }

  private getAuthHeaders(token: string) {
    return {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    };
  }
}
