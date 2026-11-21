import { avatarUrl } from "./images.js";

// Fields needed to build the signed-in user's public profile
export const PUBLIC_USER_FIELDS = "name email avatar role password googleId";

// What the browser may see about the signed-in user. The password hash and
// Google ID never leave the server; only whether they exist.
export const toPublicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: avatarUrl(user.avatar),
  hasPassword: !!user.password,
  googleLinked: !!user.googleId,
});
