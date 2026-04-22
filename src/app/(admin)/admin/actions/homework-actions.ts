"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { verifyAuthenticated, verifyTeacherOrAdmin } from "./auth-helpers";
import { logger } from "@/lib/server/logger";
import { formatStudentName } from "@/lib/utils/student-name";
import {
  STORAGE_BUCKETS,
  generateStoragePath,
  extractStoragePath,
  validateFile,
} from "@/lib/supabase/storage";
import type {
  HomeworkAssignment,
  HomeworkSubmission,
  HomeworkSubmissionFile,
} from "@/lib/types";

const BUCKET = STORAGE_BUCKETS.HOMEWORK_SUBMISSIONS;

// ── 숙제 출제 (교사/Admin) ──

/** 반별 숙제 목록 */
export async function listHomeworkAssignments(
  classId: string
): Promise<HomeworkAssignment[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("homework_assignments")
    .select("id, class_id, title, description, due_date, created_at")
    .eq("class_id", classId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("[listHomeworkAssignments]", error.message);
    return [];
  }

  const assignments = data ?? [];
  if (assignments.length === 0) return [];

  // 제출 현황
  const ids = assignments.map((a) => a.id);
  const { data: submissions } = await supabase
    .from("homework_submissions")
    .select("assignment_id, status")
    .in("assignment_id", ids);

  const submitMap = new Map<string, number>();
  for (const s of submissions ?? []) {
    if (s.status !== "pending") {
      submitMap.set(s.assignment_id, (submitMap.get(s.assignment_id) ?? 0) + 1);
    }
  }

  // 반 학생 수
  const { data: students } = await supabase
    .from("class_students")
    .select("student_profile_id")
    .eq("class_id", classId);

  return assignments.map((a) => ({
    ...a,
    submission_count: submitMap.get(a.id) ?? 0,
    total_students: students?.length ?? 0,
  })) as HomeworkAssignment[];
}

/** 숙제 생성 (교사/관리자 전용) */
export async function createHomeworkAssignment(
  classId: string,
  teacherId: string,
  title: string,
  description?: string,
  dueDate?: string
): Promise<{ error?: string; id?: string }> {
  const auth = await verifyTeacherOrAdmin();
  if ("error" in auth) return { error: auth.error };
  if (!title.trim()) return { error: "제목을 입력해 주세요." };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("homework_assignments")
    .insert({
      class_id: classId,
      teacher_id: teacherId,
      title: title.trim(),
      description: description?.trim() || null,
      due_date: dueDate || null,
    })
    .select("id")
    .single();

  if (error) {
    logger.error("[createHomeworkAssignment]", error.message);
    return { error: error.message };
  }

  // 반 학생들에게 자동으로 pending 제출 기록 생성
  const { data: students } = await supabase
    .from("class_students")
    .select("student_profile_id")
    .eq("class_id", classId);

  if (students?.length) {
    const { error: subError } = await supabase
      .from("homework_submissions")
      .insert(
        students.map((s) => ({
          assignment_id: data.id,
          student_profile_id: s.student_profile_id,
          status: "pending",
        }))
      );
    if (subError) return { error: "숙제 제출 생성에 실패했습니다." };
  }

  revalidatePath("/academy", "layout");
  return { id: data.id };
}

/** 숙제 수정 (교사/관리자 전용) */
export async function updateHomeworkAssignment(
  assignmentId: string,
  title: string,
  description?: string,
  dueDate?: string
): Promise<{ error?: string }> {
  const auth = await verifyTeacherOrAdmin();
  if ("error" in auth) return { error: auth.error };
  if (!title.trim()) return { error: "제목을 입력해 주세요." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("homework_assignments")
    .update({
      title: title.trim(),
      description: description?.trim() || null,
      due_date: dueDate || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assignmentId);

  if (error) return { error: error.message };
  revalidatePath("/academy", "layout");
  return {};
}

/** 숙제 삭제 (교사/관리자 전용) */
export async function deleteHomeworkAssignment(
  assignmentId: string
): Promise<{ error?: string }> {
  const auth = await verifyTeacherOrAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  // 제출 파일 삭제
  const { data: submissions } = await supabase
    .from("homework_submissions")
    .select("id")
    .eq("assignment_id", assignmentId);

  if (submissions?.length) {
    const subIds = submissions.map((s) => s.id);
    const { data: files } = await supabase
      .from("homework_submission_files")
      .select("storage_path")
      .in("submission_id", subIds);

    if (files?.length) {
      await supabase.storage
        .from(BUCKET)
        .remove(files.map((f) => f.storage_path));
    }
  }

  const { error } = await supabase
    .from("homework_assignments")
    .delete()
    .eq("id", assignmentId);

  if (error) return { error: error.message };
  revalidatePath("/academy", "layout");
  return {};
}

// ── 제출 관리 ──

/** 숙제별 제출 현황 (교사용) */
export async function listSubmissions(
  assignmentId: string
): Promise<HomeworkSubmission[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("homework_submissions")
    .select("id, assignment_id, student_profile_id, status, text_content, submitted_at, teacher_feedback, reviewed_at, reviewed_by, created_at, updated_at")
    .eq("assignment_id", assignmentId)
    .order("status")
    .order("submitted_at", { ascending: false });

  if (error) {
    logger.error("[listSubmissions]", error.message);
    return [];
  }

  const submissions = data ?? [];
  if (submissions.length === 0) return [];

  // 학생 이름 조인
  const studentIds = submissions.map((s) => s.student_profile_id);
  const { data: students } = await supabase
    .from("students")
    .select("profile_id, korean_name, english_name")
    .in("profile_id", studentIds);
  const nameMap = new Map(
    (students ?? []).map((s) => [
      s.profile_id,
      formatStudentName(s, { fallback: "" }),
    ])
  );

  // 첨부파일
  const subIds = submissions.map((s) => s.id);
  const { data: files } = await supabase
    .from("homework_submission_files")
    .select("*")
    .in("submission_id", subIds);

  // signed URL 배치 생성 (비공개 버킷)
  const fileMap = new Map<string, HomeworkSubmissionFile[]>();
  const allFiles = files ?? [];
  if (allFiles.length > 0) {
    const paths = allFiles.map((f) => f.storage_path);
    const { data: signedUrls } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(paths, 3600);

    for (let i = 0; i < allFiles.length; i++) {
      const f = allFiles[i];
      const file: HomeworkSubmissionFile = {
        ...f,
        signed_url: signedUrls?.[i]?.signedUrl,
      };
      const arr = fileMap.get(f.submission_id) ?? [];
      arr.push(file);
      fileMap.set(f.submission_id, arr);
    }
  }

  return submissions.map((s) => ({
    ...s,
    student_name: nameMap.get(s.student_profile_id) ?? "",
    files: fileMap.get(s.id) ?? [],
  })) as HomeworkSubmission[];
}

/** 학생 본인의 숙제 목록 */
export async function getStudentHomework(
  studentProfileId: string
): Promise<(HomeworkAssignment & { submission: HomeworkSubmission | null })[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];
  const supabase = createAdminClient();

  // 소속 반 확인
  const { data: memberships } = await supabase
    .from("class_students")
    .select("class_id")
    .eq("student_profile_id", studentProfileId);

  if (!memberships?.length) return [];
  const classIds = memberships.map((m) => m.class_id);

  // 반 이름
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .in("id", classIds);
  const classMap = new Map((classes ?? []).map((c) => [c.id, c.name]));

  // 숙제 목록
  const { data: assignments } = await supabase
    .from("homework_assignments")
    .select("id, class_id, title, description, due_date, created_at")
    .in("class_id", classIds)
    .order("created_at", { ascending: false });

  if (!assignments?.length) return [];

  // 본인 제출 내역
  const assignmentIds = assignments.map((a) => a.id);
  const { data: submissions } = await supabase
    .from("homework_submissions")
    .select("id, assignment_id, student_profile_id, status, text_content, submitted_at, teacher_feedback, reviewed_at, reviewed_by, created_at, updated_at")
    .eq("student_profile_id", studentProfileId)
    .in("assignment_id", assignmentIds);
  const subMap = new Map(
    (submissions ?? []).map((s) => [s.assignment_id, s])
  );

  return assignments.map((a) => ({
    ...a,
    class_name: classMap.get(a.class_id) ?? "",
    submission: (subMap.get(a.id) as HomeworkSubmission | undefined) ?? null,
  })) as (HomeworkAssignment & { submission: HomeworkSubmission | null })[];
}

/** 학생 숙제 제출 (텍스트 + 오디오 파일) */
export async function submitHomework(
  submissionId: string,
  textContent?: string,
  audioFile?: File
): Promise<{ error?: string }> {
  // 인증 검증: 로그인 사용자가 이 제출의 소유자인지 확인
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return { error: "인증이 필요합니다." };

  const supabase = createAdminClient();

  // 제출 소유권 검증
  const { data: submission } = await supabase
    .from("homework_submissions")
    .select("student_profile_id")
    .eq("id", submissionId)
    .single();
  if (!submission || submission.student_profile_id !== user.id) {
    return { error: "권한이 없습니다." };
  }

  // 오디오 파일 업로드
  if (audioFile && audioFile.size > 0) {
    const validation = validateFile(audioFile, "audio");
    if (!validation.valid) return { error: validation.error };

    const storagePath = generateStoragePath(audioFile.name, "audio");
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, audioFile, { contentType: audioFile.type, upsert: false });

    if (uploadError) {
      return { error: `파일 업로드 실패: ${uploadError.message}` };
    }

    await supabase.from("homework_submission_files").insert({
      submission_id: submissionId,
      storage_path: storagePath,
      original_filename: audioFile.name,
      mime_type: audioFile.type,
      file_size: audioFile.size,
    });
  }

  const { error } = await supabase
    .from("homework_submissions")
    .update({
      status: "submitted",
      text_content: textContent?.trim() || null,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  if (error) return { error: error.message };
  revalidatePath("/academy", "layout");
  return {};
}

/** 교사 피드백 작성 (교사/관리자 전용) */
export async function reviewSubmission(
  submissionId: string,
  feedback: string,
  reviewerId: string
): Promise<{ error?: string }> {
  const auth = await verifyTeacherOrAdmin();
  if ("error" in auth) return { error: auth.error };
  if (reviewerId !== auth.userId) return { error: "권한이 없습니다." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("homework_submissions")
    .update({
      status: "reviewed",
      teacher_feedback: feedback.trim() || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  if (error) return { error: error.message };
  revalidatePath("/academy", "layout");
  return {};
}

/** 제출물의 signed URL 가져오기 (소유권/역할 검증) */
export async function getSubmissionFiles(
  submissionId: string
): Promise<HomeworkSubmissionFile[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];
  const supabase = createAdminClient();

  // 소유권/역할 검증: 본인 제출물이거나, 담당 반 교사이거나, 관리자여야 함
  const { data: submission } = await supabase
    .from("homework_submissions")
    .select("student_profile_id, assignment_id")
    .eq("id", submissionId)
    .single();
  if (!submission) return [];

  if (submission.student_profile_id !== auth.userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.userId)
      .single();

    if (profile?.role === "admin") {
      // ok
    } else if (profile?.role === "teacher") {
      const { data: assignment } = await supabase
        .from("homework_assignments")
        .select("class_id")
        .eq("id", submission.assignment_id)
        .single();
      if (!assignment) return [];
      const { data: ct } = await supabase
        .from("class_teachers")
        .select("class_id")
        .eq("teacher_profile_id", auth.userId)
        .eq("class_id", assignment.class_id)
        .maybeSingle();
      if (!ct) return [];
    } else {
      return [];
    }
  }

  const { data: files } = await supabase
    .from("homework_submission_files")
    .select("*")
    .eq("submission_id", submissionId);

  const allFiles = files ?? [];
  if (allFiles.length === 0) return [];
  const paths = allFiles.map((f) => f.storage_path);
  const { data: signedUrls } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, 3600);
  return allFiles.map((f, i) => ({
    ...f,
    signed_url: signedUrls?.[i]?.signedUrl,
  }));
}
