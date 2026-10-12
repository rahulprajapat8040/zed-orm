import { describe, expectTypeOf, it } from "vitest";
import type {
  Post,
  PostCreateArgs,
  PostFindManyArgs,
  PostInclude,
  User,
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

    expectTypeOf<PostCreateArgs>().toMatchTypeOf<{
      data: {
        id: string;
        title: string;
        authorId: string;
      };
    }>();

    expectTypeOf<UserUpdateInput>().toMatchTypeOf<{
      email?: string;
    }>();
  });
});
