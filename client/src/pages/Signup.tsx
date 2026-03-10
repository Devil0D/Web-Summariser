import { LoginForm } from "@/components/login-form"; //Importing Files from Components
import { AuthForm } from "@/hooks/AuthForm";
export default function LoginPage() {

  const {
    Email,
    setEmail,
    Password,
    setPassword,
    Username,
    setUsername,
    error,
    loading,
    handleSubmit,
    loginWithgoogle,
  } = AuthForm("signup");
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10 ">
      <div className="w-full max-w-sm md:max-w-1xl">
        <LoginForm
          type="signup"
          Email={Email}
          setEmail={setEmail}
          Password={Password}
          setPassword={setPassword}
          Username={Username}
          setUsername={setUsername}
          error={error}
          loading={loading}
          onSubmit={handleSubmit}
          onGoogleLogin={loginWithgoogle}
        />
      </div>
    </div>
  );
}
