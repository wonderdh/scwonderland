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
  deleteReportCard,
  updateReportCardReply,
  listAllClassesReportStatus,
  listUntranslatedReports,
  translateReportCard,
} from "./actions/report-actions";
export type { ClassReportSummary, UntranslatedReport } from "./actions/report-actions";

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
  listClassesWithStudentIds,
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
  copyBusDayDataToOtherDays,
  getBusDayDataCounts,
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
  updateAfterschoolSecondPeriod,
  deleteAfterschoolEnrollmentDay,
} from "./actions/afterschool-actions";

export {
  getCurrentWeeklySentences,
  listAllWeeklySentences,
  upsertWeeklySentence,
  deleteWeeklySentence,
  bulkImportWeeklySentences,
  getWeeklySentenceConfig,
  updateWeeklySentenceConfig,
} from "./actions/weekly-sentence-actions";

export {
  bulkReserveAttendance,
} from "./actions/attendance-actions";

export {
  bulkCreateBusChanges,
} from "./actions/bus-actions";

export {
  getUpcomingReservations,
} from "./actions/reservation-actions";

export type {
  ReservationAttendance,
  ReservationBusChange,
} from "./actions/reservation-actions";
