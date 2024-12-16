import { Args, Context, Query, Resolver } from "@nestjs/graphql";

import {
  GetRepositoriesInputDTO,
  GetRepositoriesResponseDTO,
  GetRepositoryInputDTO,
  GetRepositoryResponseDTO,
} from "../dto/repository.args";
import { ScannerService } from "../services/scanner.service";
import { ConcurrencyLimit } from "../intercepters/concurrency.interceptor";

@Resolver()
export class ScannerResolver {
  constructor(private readonly scannerService: ScannerService) {}

  @Query((returns) => GetRepositoriesResponseDTO, { name: "getRepositories" })
  async getRepositories(
    @Args("input", { type: () => GetRepositoriesInputDTO })
    input: GetRepositoriesInputDTO,
    @Context() context,
  ): Promise<GetRepositoriesResponseDTO> {
    const repositories = await this.scannerService.findAll(input.token);
    return {
      repositories,
      total: repositories.length,
    };
  }

  @Query((returns) => GetRepositoryResponseDTO, { name: "getRepository" })
  @ConcurrencyLimit() // rate limit global
  // @Throttle(100, 60) rate limit per user
  async getRepository(
    @Args("input", { type: () => GetRepositoryInputDTO })
    input: GetRepositoryInputDTO,
    @Context() context,
  ): Promise<GetRepositoryResponseDTO> {
    const repository = await this.scannerService.findOne(
      input.token,
      input.owner,
      input.name,
    );
    return { repository };
  }
}
