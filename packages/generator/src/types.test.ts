import { describe, expectTypeOf, it } from "vitest";
import type {
  Post,
  PostCreateArgs,
  PostFindManyArgs,
  PostInclude,
  User,
  UserCreateArgs,
  UserCreateInput,
  UserFindManyArgs,
  UserFindUniqueArgs,
  UserInclude,
  UserUpdateInput,
  UserWhereInput,
} from "../test/fixtures/simple/types.js";

describe("generated type fixtures", () => {
  it("types User model fields", () => {
    expectTypeOf<User>().toEqualTypeOf<{
      readonly id: string;
      readonly email: string;
      readonly role: "ADMIN" | "USER";
      readonly posts?: readonly Post[];
    }>();
  });

  it("types Post model fields", () => {
    expectTypeOf<Post>().toEqualTypeOf<{
      readonly id: string;
      readonly title: string;
      readonly authorId: string;
      readonly author?: User;
    }>();
  });

  it("accepts valid relation includes", () => {
    expectTypeOf<{ include: { posts: true } }>().toMatchTypeOf<UserFindManyArgs>();
    expectTypeOf<{ include: { author: true } }>().toMatchTypeOf<PostFindManyArgs>();
  });

  it("rejects invalid relation includes", () => {
    expectTypeOf<{ include: { nonexistentRelation: true } }>().not.toMatchTypeOf<UserFindManyArgs>();
    expectTypeOf<{ include: { posts: true } }>().not.toMatchTypeOf<PostFindManyArgs>();
  });

  it("types query argument shapes", () => {
    expectTypeOf<UserWhereInput>().toMatchTypeOf<{
      email?: string;
      AND?: readonly UserWhereInput[];
    }>();

    expectTypeOf<UserFindUniqueArgs>().toMatchTypeOf<{
      where: UserWhereInput;
      include?: UserInclude;
    }>();

    expectTypeOf<PostFindManyArgs>().toMatchTypeOf<{
      take?: number;
      skip?: number;
      include?: PostInclude;
    }>();
  });

  it("validates create input fields and types", () => {
    expectTypeOf<{ email: string; role: "USER" }>().toMatchTypeOf<UserCreateInput>();
    expectTypeOf<UserCreateArgs>().toMatchTypeOf<{
      data: UserCreateInput;
    }>();

    expectTypeOf<{ email: number }>().not.toMatchTypeOf<UserCreateInput>();
    expectTypeOf<{ email: "test@example.com" }>().not.toMatchTypeOf<UserCreateInput>();
  });

  it("validates update input fields", () => {
    expectTypeOf<{ email?: string }>().toMatchTypeOf<UserUpdateInput>();
    expectTypeOf<{ email: 123 }>().not.toMatchTypeOf<UserUpdateInput>();
    expectTypeOf<{ id: string }>().not.toMatchTypeOf<UserUpdateInput>();
  });

  it("types Post create args with required scalar fields", () => {
    expectTypeOf<PostCreateArgs>().toMatchTypeOf<{
      data: {
        id: string;
        title: string;
        authorId: string;
      };
    }>();
  });
});
