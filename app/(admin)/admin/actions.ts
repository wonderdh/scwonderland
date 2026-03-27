export {
  getDashboardStats,
  getTodayStats,
} from "./actions/dashboard-actions";

export {
  createStudent,
  createTeacher,
  listAdmins,
  listUsersByRole,
  getTeacherAssignmentCounts,
  getStudentLinkedCounts,
  deleteUserById,
  restoreUser,
  permanentlyDeleteUser,
  listDeletedUsers,
  updateStudentProfile,
  updateTeacherProfile,
  resetUserPassword,
  bulkResetStudentPasswords,
  listAllStudents,
} from "./actions/user-actions";

export {
  getReportCard,
  listReportCardsByStudent,
  upsertReportCard,
  updateReportCardReply,
} from "./actions/report-actions";

export {
  listClassesWithDetails,
  getClassWithStudents,
  getStudentClasses,
  getAllClassStudentsFlat,
  createClass,
  updateClass,
  deleteClass,
  getClassLinkedCounts,
  addStudentToClass,
  removeStudentFromClass,
  batchUpdateClassStudents,
  listTeachersForSelect,
  listStudentsNotInClass,
} from "./actions/class-actions";

export {
  listNotices,
  getNoticeWithAttachments,
  createNotice,
  updateNotice,
  deleteNotice,
} from "./actions/notice-actions";

export {
  listTextbooks,
  getClassTextbookProgress,
  batchUpdateProgress,
  batchUpdateClassTextbooks,
  getTextbookLinkedCounts,
} from "./actions/textbook-actions";

export {
  listLearningRecords,
  createLearningRecord,
  updateLearningRecord,
  deleteLearningRecord,
} from "./actions/learning-actions";

export {
  listAttendanceRecords,
  recordAttendance,
  deleteAttendance,
  getAttendanceStats,
  getClassAttendanceByDate,
  getClassStudentsWithAttendance,
  bulkRecordAttendance,
  getStudentAttendanceByDate,
} from "./actions/attendance-actions";

export {
  listClassNotices,
  getClassNoticeWithAttachments,
  createClassNotice,
  updateClassNotice,
  deleteClassNotice,
  getMyClassNotices,
} from "./actions/class-notice-actions";

export {
  listAcademyNotices,
  getAcademyNoticeWithAttachments,
  createAcademyNotice,
  updateAcademyNotice,
  deleteAcademyNotice,
} from "./actions/academy-notice-actions";

export {
  listHomeworkAssignments,
  createHomeworkAssignment,
  updateHomeworkAssignment,
  deleteHomeworkAssignment,
  listSubmissions,
  getStudentHomework,
  submitHomework,
  reviewSubmission,
  getSubmissionFiles,
} from "./actions/homework-actions";

export {
  listClassSchedules,
  addClassScheduleBatch,
  deleteClassSchedule,
  getStudentTimetable,
  getGroupTimetableGrid,
  addSingleClassSchedule,
  setClassScheduleSlot,
  getStudentTimetableEditable,
  deleteStudentSchedule,
} from "./actions/schedule-actions";

export {
  listAcademyPeriods,
  createAcademyPeriod,
  updateAcademyPeriod,
  deleteAcademyPeriod,
} from "./actions/timetable-actions";

export {
  listAllActiveStudentNames,
  listBusNumbers,
  createBusNumber,
  updateBusNumber,
  deleteBusNumber,
  listBusTimeSlots,
  createBusTimeSlot,
  updateBusTimeSlot,
  deleteBusTimeSlot,
  getStudentBusDefaults,
  upsertStudentBusDefault,
  deleteStudentBusDefault,
  deleteStudentBusDefaults,
  getDailyBusManifest,
  listPendingChangeRequests,
  listAllChangeRequests,
  listChangeRequestsByDate,
  approveChangeRequest,
  rejectChangeRequest,
  getStudentChangeRequests,
  submitBusChangeRequest,
  cancelBusChangeRequest,
  boardBusStudent,
  unboardBusStudent,
  checkBusStudent,
  uncheckBusStudent,
  batchBusCheckRecord,
  createBusStaff,
  listBusStaff,
  updateBusStaff,
  listBusStops,
  createBusStop,
  updateBusStop,
  deleteBusStop,
  listBusStopDayAssignments,
  saveBusStopDayAssignments,
  listBusStopSchedulesBulk,
  saveBulkBusDefaults,
  getBulkBusDefaults,
  listBusStopSchedules,
  upsertBusStopSchedule,
  deleteBusStopSchedule,
  createAdminBusChange,
  updateAdminBusChange,
  getExistingBusChange,
  deleteAdminBusChange,
  getWeeklyDropoffExportData,
} from "./actions/bus-actions";

export type { DropoffExportRow, DropoffExportData } from "@/lib/types";

export {
  getOrCreateAfterschoolClass,
  getAfterschoolEnrollments,
  enrollStudent,
  removeAfterschoolStudent,
  listAvailableStudents,
  bulkUpdateEnrollmentDays,
  listAfterschoolStudentIdsByDay,
  getStudentAfterschoolDetail,
} from "./actions/afterschool-actions";
