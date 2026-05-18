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

export {
  listClassesWithDetails,
  listClassesForHomeworkPicker,
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

export type { HomeworkClassPickerOption } from "./actions/class-actions";

export {
  listNotices,
  getNoticeWithAttachments,
  createNotice,
  updateNotice,
  deleteNotice,
} from "./actions/notice-actions";

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

export {
  createBusStaff,
  listBusStaff,
  updateBusStaff,
} from "./actions/bus-staff";

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

export {
  listTextbooks,
  getTextbook,
  createSeriesLevel,
  updateSeriesLevel,
  deleteSeriesLevel,
} from "./actions/textbook-actions";

export type { TextbookWithSeries } from "./actions/textbook-actions";

export {
  listSeries,
  listAllSeries,
  getSeries,
  createSeries,
  updateSeries,
  deleteSeries,
  listSeriesLevels,
  listLevelsBySeries,
} from "./actions/series-actions";

export type { SeriesWithPublisher, SeriesLevelRow } from "./actions/series-actions";

export {
  listPublishers,
  listAllPublishers,
  getPublisher,
  createPublisher,
  updatePublisher,
  deletePublisher,
} from "./actions/publisher-actions";

export {
  listClassTextbooks,
  assignClassTextbook,
  updateClassTextbookDays,
  unassignClassTextbook,
  listStudentTextbooks,
  assignStudentTextbook,
  updateStudentTextbookDays,
  unassignStudentTextbook,
  listStudentScheduleByMonth,
} from "./actions/class-textbook-actions";

export type {
  ClassTextbookWithDetails,
  StudentTextbookWithDetails,
} from "./actions/class-textbook-actions";

export type {
  StudentDayUnits,
  StudentDayUnit,
  UnitAssignment,
} from "@/lib/utils/homework-schedule";

export { getUnitSchedule } from "@/lib/utils/homework-schedule";

export {
  listUnitProgressByStudent,
  listUnitProgressByClass,
  listClassUnitProgressDetailed,
  markUnit,
  bulkMarkUnits,
  clearUnit,
} from "./actions/homework-unit-actions";

export type {
  UnitStatus,
  StudentTextbookUnits,
  StudentUnitProgressData,
  ClassUnitOverview,
  ClassUnitProgressDetailed,
} from "./actions/homework-unit-actions";
