import { Directive, Field, ID, ObjectType } from "@nestjs/graphql";

export class Repository {}
@ObjectType({ description: "repository" })
export class RepositoryModel {
  @Field()
  name: string;

  @Field()
  size: number;

  @Field()
  owner: string;
}
