export default function AcademyLoginPage() {
  return (
    <div className="max-w-sm mx-auto mt-12 p-6 bg-white rounded-xl shadow-sm border border-slate-200">
      <h1 className="text-xl font-semibold text-slate-800 mb-2">
        학원 로그인
      </h1>
      <p className="text-slate-500 text-sm mb-6">
        로그인 기능은 곧 연동됩니다. (학생 · 선생님 계정)
      </p>
      <form className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            이메일 또는 아이디
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400"
            placeholder="입력"
            disabled
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            비밀번호
          </label>
          <input
            type="password"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
            placeholder="입력"
            disabled
          />
        </div>
        <button
          type="button"
          className="w-full py-2.5 bg-slate-200 text-slate-500 rounded-lg font-medium cursor-not-allowed"
          disabled
        >
          로그인 (준비 중)
        </button>
      </form>
    </div>
  );
}
