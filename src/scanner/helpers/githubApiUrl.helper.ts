import { GITHUB_API_URL } from "../constants/github.constants";

export class GithubApiUrlHelper {
  static getReposUrl(): string {
    return `${GITHUB_API_URL}/user/repos`;
  }

  static getOrgsUrl(): string {
    return `${GITHUB_API_URL}/user/orgs`;
  }

  static getRepoUrl(owner: string, repo: string): string {
    return `${GITHUB_API_URL}/repos/${owner}/${repo}`;
  }

  static getRepoContentsUrl(owner: string, repo: string): string {
    return `${GITHUB_API_URL}/repos/${owner}/${repo}/contents`;
  }
  static getRepoHooksUrl(owner: string, repo: string): string {
    return `${GITHUB_API_URL}/repos/${owner}/${repo}/hooks`;
  }

  static getRepoContentsFileUrl(
    owner: string,
    repo: string,
    path: string,
  ): string {
    return `${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${path}`;
  }
}
