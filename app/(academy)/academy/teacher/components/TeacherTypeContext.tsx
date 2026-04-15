"use client";

import { createContext, useContext } from "react";
import type { TeacherType } from "@/lib/ui/teacher-labels";

const TeacherTypeContext = createContext<TeacherType>("korean");

export function TeacherTypeProvider({
  teacherType,
  children,
}: {
  teacherType: TeacherType;
  children: React.ReactNode;
}) {
  return (
    <TeacherTypeContext.Provider value={teacherType}>
      {children}
    </TeacherTypeContext.Provider>
  );
}

export function useTeacherType(): TeacherType {
  return useContext(TeacherTypeContext);
}
