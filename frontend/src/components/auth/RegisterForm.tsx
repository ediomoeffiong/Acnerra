import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/Card";

export function RegisterForm() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, setIsPending] = useState(false);
  
  const navigate = useNavigate();
  const { checkAuth } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setError(null);
    setFieldErrors({});

    try {
      await api.post("/auth/register", { name, username, email, password });
      await checkAuth(); // Refresh the user context
      navigate("/dashboard");
    } catch (err: any) {
      if (!err.response) {
        setError("Service is currently unavailable. Please try again later.");
      } else if (err.response.status === 500) {
        setError("Service is currently unavailable. Please try again later.");
      } else if (err.response.data?.errors) {
        setFieldErrors(err.response.data.errors);
      } else if (err.response.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("User with this email or username already exists.");
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-zinc-800 bg-zinc-950/80 backdrop-blur-md shadow-2xl p-2">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl font-bold tracking-tight text-zinc-100">Create an account</CardTitle>
        <CardDescription className="text-xs text-zinc-400">
          Join Acnerra and start achieving goals with accountability partners
        </CardDescription>
      </CardHeader>

      <CardContent className="mt-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="name"
            name="name"
            label="Full name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fieldErrors?.name?.[0]}
            placeholder="John Doe"
          />

          <Input
            id="username"
            name="username"
            label="Username"
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            error={fieldErrors?.username?.[0]}
            placeholder="johndoe"
          />

          <Input
            id="email"
            name="email"
            label="Email address"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors?.email?.[0]}
            placeholder="name@example.com"
          />

          <Input
            id="password"
            name="password"
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors?.password?.[0]}
            placeholder="••••••••"
            helperText="Must be at least 8 characters"
          />

          {error ? (
            <div className="flex items-center gap-2.5 p-3 text-xs text-red-400 bg-red-950/20 border border-red-900/30 rounded-lg">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p className="font-medium">{error}</p>
            </div>
          ) : null}

          <Button
            type="submit"
            loading={isPending}
            className="w-full font-semibold"
          >
            Sign up
          </Button>

          <div className="text-center pt-2">
            <p className="text-xs text-zinc-400">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
