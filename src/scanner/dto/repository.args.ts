import { Field, ID, InputType, ObjectType } from "@nestjs/graphql";
import { IsNotEmpty, IsString } from "class-validator";

import { RepositoryModel } from "../models/repository.model";

@InputType()
class TokenDTO {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  token: string;
}

@InputType()
export class GetRepositoriesInputDTO extends TokenDTO {}

@ObjectType()
export class ListRepositoryModel {
  @Field()
  name: string;

  @Field()
  owner: string;

  @Field()
  size: number;
}

@ObjectType()
export class GetRepositoriesResponseDTO {
  @Field((type) => [ListRepositoryModel])
  repositories: ListRepositoryModel[];

  @Field()
  total: number;
}

@InputType()
export class GetRepositoryInputDTO extends TokenDTO {
  @Field((type) => ID)
  @IsString()
  @IsNotEmpty()
  name: string;

  @Field((type) => ID)
  @IsString()
  @IsNotEmpty()
  owner: string;
}

@ObjectType()
export class Webhook {
  @Field()
  name: string;
}

@ObjectType()
export class DetailedRepositoryModel extends ListRepositoryModel {
  @Field()
  isPrivate: boolean;

  @Field()
  fileCount: number;

  @Field({ nullable: true })
  ymlContent: string | null;

  @Field(() => [Webhook])
  activeWebhooks: Webhook[];
}

@ObjectType()
export class GetRepositoryResponseDTO {
  @Field(() => DetailedRepositoryModel)
  repository?: DetailedRepositoryModel;
}
