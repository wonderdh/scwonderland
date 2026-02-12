import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function AcademyLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-sm mx-auto mt-12 p-6 bg-white rounded-xl shadow-sm border border-slate-200 animate-pulse">
          <div className="h-7 bg-slate-200 rounded w-32 mb-2" />
          <div className="h-4 bg-slate-100 rounded w-full mb-6" />
          <div className="h-10 bg-slate-100 rounded mb-4" />
          <div className="h-10 bg-slate-100 rounded mb-4" />
          <div className="h-10 bg-slate-200 rounded" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
