import { LoginCard } from '../../components/login-card';

// En Next 16 `searchParams` es una promesa. El código de error lo pone el backend al volver de
// Atlassian (por ejemplo /login?error=cancelled).
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  return <LoginCard errorCode={Array.isArray(error) ? error[0] : error} />;
}
