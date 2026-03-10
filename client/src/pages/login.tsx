import { LoginForm } from "@/components/login-form"; //Importing Files from Components
import { AuthForm } from "@/hooks/AuthForm";
export default function LoginPage() {
  const {
    Email,
    setEmail,
    Password,
    setPassword,
    error,
    loading,
    handleSubmit,
    loginWithgoogle,
    loginWithfacebook,
  } = AuthForm("login");

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10 ">
      <div className="w-full max-w-sm md:max-w-1xl ">
        <LoginForm
          type="login"
          Email={Email}
          setEmail={setEmail}
          Password={Password}
          setPassword={setPassword}
          loading={loading}
          error={error}
          onSubmit={handleSubmit}
          onGoogleLogin={loginWithgoogle}
          onFacebookLogin={loginWithfacebook}
        />
      </div>
    </div>
  );
}
