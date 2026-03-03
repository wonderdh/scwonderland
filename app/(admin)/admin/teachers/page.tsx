import {
  deleteUserById,
  listUsersByRole,
  listDeletedUsers,
  restoreUser,
  permanentlyDeleteUser,
  listClassesWithDetails,
  updateTeacherProfile,
  getGroupTimetableGrid,
} from "../actions";
import { AdminListSidebar } from "../components/AdminListSidebar";
import { ScrollToSection } from "../components/ScrollToSection";
import { UserList } from "../components/UserList";
import { AddTeacherForm } from "./components/AddTeacherForm";
import { TeacherInfoCard } from "./components/TeacherInfoCard";
import { TeacherTabNav, type TeacherTabId } from "./components/TeacherTabNav";
import { TeacherClassesTab } from "./components/TeacherClassesTab";
import { TeacherTimetableTab } from "./components/TeacherTimetableTab";
import { TrashView } from "../components/TrashView";

const VALID_TABS: TeacherTabId[] = ["info", "classes", "timetable"];

function parseTab(tab: string | undefined): TeacherTabId {
  if (tab && VALID_TABS.includes(tab as TeacherTabId)) return tab as TeacherTabId;
  return "info";
}

export default async function AdminTeachersPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; selected?: string; tab?: string }>;
}) {
  const { section, selected, tab } = await searchParams;
  const currentTab = parseTab(tab);

  const [users, classes] = await Promise.all([
    listUsersByRole("teacher"),
    listClassesWithDetails(),
  ]);
  const selectedUser = selected ? users.find((u) => u.id === selected) : null;
  const deletedUsers = section === "trash" ? await listDeletedUsers("teacher") : [];

  // 시간표 탭이면 3개 그룹 데이터 로드
  let allGroupData: Record<string, Awaited<ReturnType<typeof getGroupTimetableGrid>>> = {};
  if (selectedUser && currentTab === "timetable") {
    const [kg, af, as] = await Promise.all([
      getGroupTimetableGrid("유치부"),
      getGroupTimetableGrid("오후반"),
      getGroupTimetableGrid("방과후"),
    ]);
    allGroupData = { "유치부": kg, "오후반": af, "방과후": as };
  }

  return (
    <div className="flex flex-1 min-w-0 -m-6 md:-m-8">
      <AdminListSidebar users={users} variant="teachers" />
      <div className="flex-1 min-w-0 p-6 md:p-8 flex flex-col">
        {section === "trash" ? (
          <TrashView
            users={deletedUsers}
            variant="teacher"
            onRestore={restoreUser}
            onPermanentDelete={permanentlyDeleteUser}
          />
        ) : section === "add" ? (
          <>
            <ScrollToSection section="add" />
            <section id="add" className="mb-8">
              <AddTeacherForm />
            </section>
            <section>
              <h2 className="text-lg font-medium text-slate-700 mb-3">선생 목록</h2>
              <UserList
                users={users}
                roleLabel="선생"
                variant="teacher"
                onUpdate={updateTeacherProfile}
                onDelete={deleteUserById}
              />
            </section>
          </>
        ) : selectedUser ? (
          <>
            <TeacherTabNav selectedId={selectedUser.id} currentTab={currentTab} />
            <div className="rounded-b-xl border border-t-0 border-slate-200 bg-white p-6 flex-1">
              {currentTab === "info" && (
                <TeacherInfoCard user={selectedUser} onUpdate={updateTeacherProfile} onDelete={deleteUserById} />
              )}
              {currentTab === "classes" && (
                <TeacherClassesTab teacherProfileId={selectedUser.id} classes={classes} />
              )}
              {currentTab === "timetable" && (
                <TeacherTimetableTab
                  teacherProfileId={selectedUser.id}
                  allGroupData={allGroupData}
                />
              )}
            </div>
          </>
        ) : (
          <div className="py-12 rounded-xl border border-slate-200 border-dashed bg-slate-50/50 flex items-center justify-center flex-1">
            <p className="text-slate-400 text-sm">왼쪽 목록에서 선생을 선택하세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
