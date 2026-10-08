import type { TFunction } from 'i18next';
import { ApiRequestError, NetworkError } from '@/lib/api-client';

/**
 * Turns any error into a message for the user, in their language — never the
 * server's English text or a browser's technical one ("Failed to fetch").
 *
 * - No connection / server restarting: says so (and that it can be retried).
 * - A refusal by the server: its known messages are translated one by one
 *   (SERVER_MESSAGES); otherwise a message for its code (not allowed, not
 *   found, invalid data…), or a generic one.
 * - An error made by the app itself (already in the user's language) is
 *   shown as is.
 */
export function errorMessage(err: unknown, t: TFunction): string {
  if (err instanceof NetworkError) {
    if (!navigator.onLine) return t('errors.offline');
    return t(err.kind === 'server' ? 'errors.serverUnavailable' : 'errors.serverUnreachable');
  }
  // fetch() failures and unreadable answers outside the API client.
  if (err instanceof TypeError && /fetch|network|load failed/i.test(err.message)) {
    return t(navigator.onLine ? 'errors.serverUnreachable' : 'errors.offline');
  }
  if (err instanceof SyntaxError) return t('errors.serverUnavailable');

  if (err instanceof ApiRequestError) {
    return serverMessage(err.message, t) ?? t(CODE_MESSAGES[err.code] ?? 'errors.generic');
  }
  if (err instanceof Error) return serverMessage(err.message, t) ?? (err.message || t('errors.generic'));
  if (typeof err === 'string' && err) return serverMessage(err, t) ?? err;
  return t('errors.generic');
}

/** Messages for the server's error codes, when its message isn't known. */
const CODE_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'errors.sessionExpired',
  FORBIDDEN: 'errors.forbidden',
  NOT_FOUND: 'errors.notFound',
  CONFLICT: 'errors.conflict',
  RATE_LIMIT_EXCEEDED: 'errors.tooManyRequests',
  FILE_TOO_LARGE: 'errors.fileTooLarge',
  INVALID_FILE_TYPE: 'errors.fileType',
  VALIDATION_ERROR: 'errors.validation',
  INVALID_REQUEST: 'errors.validation',
  INTERNAL_ERROR: 'errors.serverError',
  SERVER_ERROR: 'errors.serverError',
};

/**
 * The server's messages a user can meet, each with its translation key under
 * `errors.server`. Named groups are passed to the translation.
 */
const SERVER_MESSAGES: Array<[RegExp, string]> = [
  // Generic (more specific "… not found" messages come first, below)
  [/^The requested resource was not found$/, 'notFound'],
  [/^Request body validation failed$|^Validation failed$|^Query parameter validation failed$|^Route parameter validation failed$/, 'validation'],
  [/^Too many (requests|attempts), please try again later$/, 'tooManyRequests'],
  [/^Internal server error$/, 'server'],
  [/^Access denied/, 'forbidden'],
  [/^This operation is restricted to Staff/, 'forbidden'],
  [/^You do not have access to/, 'forbidden'],
  [/is already deleted$/, 'alreadyDeleted'],
  [/is not deleted$/, 'notDeleted'],
  [/^Cannot permanently delete/, 'hasDependents'],
  [/^Cannot restore: an active/, 'restoreDuplicate'],
  [/^Only deleted records can be permanently removed$/, 'notDeleted'],
  [/^No fields to update$/, 'noChanges'],
  [/^Invalid or expired authentication token$|^Authentication token is required$|^Invalid or expired refresh token$/, 'sessionExpired'],
  [/^File type not allowed$|^Only JPEG, PNG and WebP images are allowed$/, 'fileType'],
  [/^No file uploaded$|^No photos uploaded$|^Logo image file is required$|^Photo file is required/, 'noFile'],
  [/^Invalid or expired file link$/, 'fileLinkExpired'],

  // Accounts
  [/^Invalid email or password$/, 'invalidCredentials'],
  [/^Account is deactivated$/, 'accountDeactivated'],
  [/^School account is inactive$/, 'schoolInactive'],
  [/^A user with this email already exists$/, 'emailTaken'],
  [/^A previously removed user with this email exists in this school$/, 'emailTakenDeleted'],
  [/^Invalid email address$/, 'invalidEmail'],
  [/^User not found( in this school)?$/, 'userNotFound'],
  [/^User is already active$/, 'userAlreadyActive'],
  [/^User is already deactivated$/, 'userAlreadyDeactivated'],
  [/^Invalid invitation token$/, 'invitationInvalid'],
  [/^Invitation token has already been used$/, 'invitationUsed'],
  [/^Invitation token has expired$/, 'invitationExpired'],
  [/^Invalid or expired reset token$/, 'resetLinkInvalid'],
  [/^Reset token has already been used$/, 'resetLinkUsed'],
  [/^Reset token has expired$/, 'resetLinkExpired'],

  // School, academic years, classrooms
  [/^School not found$/, 'schoolNotFound'],
  [/^School is already active$/, 'schoolAlreadyActive'],
  [/^School is already deactivated$/, 'schoolAlreadyDeactivated'],
  [/^Academic year not found/, 'yearNotFound'],
  [/^Academic year is already active$/, 'yearAlreadyActive'],
  [/^Academic year is already inactive$/, 'yearAlreadyInactive'],
  [/^Cannot delete an active academic year/, 'yearDeleteActive'],
  [/^No active academic year/, 'noActiveYear'],
  [/^Classroom not found/, 'classroomNotFound'],
  [/^One or more (selected )?classrooms/, 'classroomNotFound'],
  [/^Cannot delete classroom with enrolled children/, 'classroomHasChildren'],
  [/^Classroom "(?<classroom>.+)" is at full capacity \((?<capacity>\d+)\)\.$/, 'classroomFull'],
  [/^Teacher not found, does not belong to this school, or is not an active teacher$/, 'teacherNotFound'],

  // Children and parents
  [/^Child not found/, 'childNotFound'],
  [/^Some children were not found in this school$/, 'childNotFound'],
  [/^Child is already enrolled in classroom "(?<classroom>.+)"\.$/, 'childAlreadyInClassroom'],
  [/^Child does not have a photo$/, 'childNoPhoto'],
  [/^Maximum of 2 parent links per child has been reached$/, 'maxParents'],
  [/^This parent is already linked to this child$/, 'parentAlreadyLinked'],
  [/^Parent user not found/, 'parentNotFound'],
  [/^Parent-child link not found$|^The specified parent is not linked to this child$/, 'parentLinkNotFound'],
  [/^No parent is linked to this child$/, 'noParentLinked'],
  [/^Emergency contact not found$/, 'notFound'],
  [/^Medical note not found$/, 'notFound'],
  [/^This child is not in your assigned classroom\.?$/, 'childNotInYourClassroom'],
  [/^You are not assigned to this classroom/, 'notYourClassroom'],
  [/^You can only (create|update|view|upload photos to) reports? (for|to reports for) children in your classroom$/, 'childNotInYourClassroom'],
  [/^You can only view reports for your linked children$|^You can only respond to consent forms for your linked children$/, 'notYourChild'],

  // Attendance, reports, communication
  [/^Attendance record not found$/, 'notFound'],
  [/^Attendance already marked/, 'attendanceAlreadyMarked'],
  [/^A daily report already exists for this child on this date$/, 'reportExists'],
  [/^Daily report not found$/, 'notFound'],
  [/^Announcement not found$|^Event not found$|^Notification not found$/, 'notFound'],
  [/^Consent form not found/, 'notFound'],
  [/^Conversation not found$|^Message not found$/, 'conversationNotFound'],
  [/^Content is required for text messages$/, 'messageEmpty'],
  [/^Only conversation participants can send messages$|^You can only create conversations with parents of children in your classroom$/, 'forbidden'],
  [/^You cannot start a conversation with yourself$/, 'conversationSelf'],
  [/^No teacher is assigned to this child's classroom$/, 'noTeacherAssigned'],

  // Staff and payroll
  [/^Staff profile not found$|^Employee not found$|^Target user not found or is not a staff member/, 'staffNotFound'],
  [/^A staff profile already exists for this user$/, 'staffProfileExists'],
  [/^Payment for (?<month>\d+)\/(?<year>\d+) already exists for this employee$/, 'salaryAlreadyPaid'],
  [/^Net salary cannot be negative/, 'salaryNegative'],
  [/^baseSalary must match/, 'salaryMismatch'],
  [/^No document uploaded for this staff profile$/, 'noFile'],

  // Fees, enrollments, payments, expenses
  [/^Fee not found$/, 'feeNotFound'],
  [/^Fee is not active$|: fee is not available$/, 'feeInactive'],
  [/^This fee has already been applied to this enrollment$/, 'feeAlreadyApplied'],
  [/^This fee applies to the whole school/, 'feeWholeSchool'],
  [/^A discount can only target a recurring fee$/, 'discountRecurringOnly'],
  [/^Discount not found$/, 'notFound'],
  [/^Enrollment not found$/, 'enrollmentNotFound'],
  [/^An enrollment already exists for this child in the specified academic year/, 'enrollmentExists'],
  [/^Start date must be within the academic year range/, 'startDateOutsideYear'],
  [/^No billing periods to generate/, 'startDateOutsideYear'],
  [/^Withdrawal date must be on or after the enrollment start date$/, 'withdrawalBeforeStart'],
  [/^Withdrawal date must be on or before the latest billing period end date/, 'withdrawalAfterEnd'],
  [/^Enrollment status must be 'active' to withdraw/, 'enrollmentNotActive'],
  [/^No billing configuration found for this branch$/, 'noBillingConfig'],
  [/^Calendar entry overlaps with existing entry$/, 'calendarOverlap'],
  [/^Calendar entry not found$/, 'notFound'],
  [/^Billing period not found$|^Billing period\(s\) not found|^Billing period \S+ does not belong to the target child$/, 'periodNotFound'],
  [/^Billing period is already cancelled$/, 'periodAlreadyCancelled'],
  [/^Billing period \S+ is cancelled and cannot receive payments$/, 'periodCancelled'],
  [/^Allocation amount .* exceeds outstanding balance/, 'exceedsOutstanding'],
  [/^Allocation sum .* does not equal total amount/, 'allocationMismatch'],
  [/^Duplicate billing period IDs in allocations/, 'allocationDuplicate'],
  [/^Target child not found or has no enrollments$/, 'childNotEnrolled'],
  [/^Value date cannot be in the future$/, 'futureDate'],
  [/^reference_note is required for ccp\/baridimob channels/, 'referenceRequired'],
  [/^reference_note is required for corrections/, 'reasonRequired'],
  [/^Correction for period .* exceeds correctable amount/, 'correctionTooLarge'],
  [/^Payment not found$|^Payment record not found$|^No receipt exists for the requested identifier$/, 'paymentNotFound'],
  [/^This period is not late$/, 'periodNotLate'],
  [/^The parents were already reminded today$/, 'alreadyReminded'],
  [/^No email address to send the receipt to$/, 'noEmailForReceipt'],
  [/^The attachment is not a PDF$/, 'fileType'],
  [/^Expense not found$/, 'notFound'],
  [/^No receipt uploaded for this expense$/, 'noFile'],
  [/^Failed to send email/, 'emailFailed'],

  // Any other "… not found" (checked last)
  [/^[\w -]+ not found$/i, 'notFound'],
];

function serverMessage(message: string, t: TFunction): string | null {
  const text = message.trim();
  for (const [pattern, key] of SERVER_MESSAGES) {
    const match = pattern.exec(text);
    if (match) return t(`errors.server.${key}`, { ...match.groups });
  }
  return null;
}
