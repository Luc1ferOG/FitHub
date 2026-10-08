export type AuthUser = {
  id: string;
  email: string | null;
};

export type AuthSession = {
  user: AuthUser;
  expiresAt: number | null;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type RegistrationDetails = LoginCredentials & {
  username: string;
  displayName: string;
};

export type RegistrationResult = {
  user: AuthUser;
  session: AuthSession | null;
};
