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
    // A refused form: say what is wrong with the first field the server names, when it is known.
    for (const detail of err.details ?? []) {
      const known = serverMessage(detail.message, t);
      if (known && known !== t('errors.server.validation')) return known;
    }
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
  [/^The trial period of this school has ended$/, 'trialEnded'],
  [/^This school is not on trial$/, 'notOnTrial'],
  [/^The name typed is not the name of this school$/, 'purgeNameMismatch'],
  [/^Only a school whose trial has ended/, 'purgeNotAllowed'],
  [/^This school has paid a subscription/, 'purgePaid'],
  [/^A user with this email already exists$/, 'emailTaken'],
  [/^A user with this phone number already exists$|^Another account already uses this phone number$/, 'phoneTaken'],
  [/^An email or a phone number is required$/, 'emailOrPhoneRequired'],
  [/^Your phone number is how you sign in/, 'phoneIsLogin'],
  [/^This account has no email/, 'noEmailForLink'],
  [/^A previously removed user with this email exists in this school$/, 'emailTakenDeleted'],
  [/^Invalid email address$/, 'invalidEmail'],

  // What a form may send
  [/^This is not a real date$|^Date must be in YYYY-MM-DD format$/, 'dateInvalid'],
  [/^This date cannot be in the future$/, 'futureDate'],
  [/^The date of birth cannot be in the future$/, 'birthFuture'],
  [/^The date of birth is too far in the past$/, 'birthTooOld'],
  [/^The enrollment date cannot be before the date of birth$/, 'enrolledBeforeBirth'],
  [/^A name needs at least 2 letters and no digits$|^Name is required$/, 'nameInvalid'],
  [/^This phone number is not valid$|^Phone number must contain only digits/, 'phoneInvalid'],
  [/^The end date cannot be before the start date$|^End date must be after start date$/, 'endBeforeStart'],
  [/^Capacity must not exceed (?<max>\d+)$/, 'capacityTooHigh'],
  [/^Amount must not exceed/, 'amountTooHigh'],
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
  [/^(Source )?[Aa]cademic year not found/, 'yearNotFound'],
  [/^Choose another year to copy from$/, 'rolloverSameYear'],
  [/^This school year is closed/, 'yearClosed'],

  // Inventory
  [/^Supply not found$/, 'supplyNotFound'],
  [/^A supply with this name already exists$/, 'supplyNameTaken'],
  [/^This supply has a history/, 'supplyHasHistory'],
  [/^This supply is put aside$/, 'supplyAside'],
  [/^Not enough in stock \((?<left>.+) left\)$/, 'supplyNotEnough'],
  [/^Only an administrator can record purchases and counts$/, 'supplyAdminOnly'],
  [/^Only the director can record expenses$/, 'expenseDirectorOnly'],

  // Rights
  [/^Your profile does not allow this$/, 'notAllowed'],
  [/^Only the director can manage director accounts$/, 'directorAccountsOnly'],
  [/^A profile with this name already exists$/, 'profileNameTaken'],
  [/^The default profile cannot be deleted$/, 'defaultProfileUndeletable'],
  [/^Choose another default profile instead$/, 'chooseOtherDefault'],
  [/^Profile not found$/, 'profileNotFound'],
  [/^Only office staff \(administrative\) have a profile$/, 'profileOnlyOffice'],
  [/^This right is on or off$/, 'rightOnOff'],
  [/^The end date is already past$/, 'endDatePast'],
  [/^Exception not found$/, 'exceptionNotFound'],

  // Teacher replacements
  [/^This class already has a replacement on these dates$/, 'classAlreadyReplaced'],
  [/^The substitute is the class's own teacher$/, 'substituteIsTitular'],
  [/^The substitute must be an active teacher of the school$/, 'substituteNotTeacher'],
  [/^The substitute already replaces in (?<classroom>.+) on these dates$/, 'substituteBusy'],
  [/^The dates must be within the class's school year$/, 'substitutionOutsideYear'],
  [/^The end date must be on or after the start date$/, 'substitutionEndBeforeStart'],
  [/^This replacement was cancelled$/, 'substitutionCancelled'],
  [/^This replacement has already ended$/, 'substitutionEnded'],
  [/^Replacement not found$/, 'substitutionNotFound'],
  [/^Equipment not found$/, 'equipmentNotFound'],
  // Planning
  [/^A shift must end after it starts$/, 'shiftEndsBeforeStart'],
  [/^Two shifts of a day cannot overlap$/, 'shiftsOverlap'],
  [/^At most two shifts a day$/, 'shiftsTooMany'],
  [/^A usual week is the same every week or alternates, not both$/, 'shiftsMixed'],
  [/^A time is written HH:MM$/, 'timeInvalid'],
  [/^This person is already recorded away on these dates$/, 'absenceOverlap'],
  [/^An absence cannot last more than a year$/, 'absenceTooLong'],
  [/^Absence not found$/, 'absenceNotFound'],
  // Documents
  [/^Document not found$/, 'documentNotFound'],
  [/^A document with this name already exists$/, 'documentNameTaken'],
  [/^This kind of file is not accepted in the documents$/, 'fileType'],
  // Cash desks
  [/^Nobody collects their own cash desk$/, 'cashOwnDesk'],
  [/^The cash desk changed meanwhile, check the amounts again$/, 'cashDeskChanged'],
  [/^There is nothing to collect in this cash desk$/, 'cashNothingToCollect'],
  [/^A reason is required when the counted amount differs$/, 'cashReasonRequired'],
  [/^The float left cannot exceed the counted amount$/, 'cashFloatTooHigh'],
  [/^Cash desk not found$/, 'cashDeskNotFound'],
  [/^Handover not found$/, 'cashHandoverNotFound'],
  [/^This expense was counted in a cash handover and can no longer be changed$/, 'expenseHandedOver'],
  [/^The billing start date must be within the new school year$/, 'rolloverStartOutside'],
  [/^A child is sent to a class that is not copied$/, 'rolloverClassNotCopied'],
  [/^The school has no branch to bill from$/, 'rolloverNoBranch'],
  [/^Academic year is already active$/, 'yearAlreadyActive'],
  [/^Academic year is already inactive$/, 'yearAlreadyInactive'],
  [/^Cannot delete an active academic year/, 'yearDeleteActive'],
  [/^No active academic year/, 'noActiveYear'],
  [/^Classroom not found/, 'classroomNotFound'],
  [/^One or more (selected )?classrooms/, 'classroomNotFound'],
  [/^Cannot delete classroom with enrolled children/, 'classroomHasChildren'],
  [/^Classroom "(?<classroom>.+)" is at full capacity \((?<capacity>\d+)\)\.$/, 'classroomFull'],
  [/^Room not found$/, 'roomNotFound'],
  [/^Use "change password" for your own account$/, 'resetOwnPassword'],
  [/^The reset email could not be sent$/, 'resetEmailFailed'],
  [/^A room named "(?<room>.+)" already exists$/, 'roomNameTaken'],
  [/^Cannot delete a room used by a class/, 'roomInUse'],
  [/^Room is inactive$/, 'roomInactive'],
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
  [/^A payment can only pay échéances of one school year$/, 'mixedYears'],
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
  [/^No email address to send the statement to$/, 'noEmailForStatement'],
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
  // "<who>: <message>" — a refusal about one child or fee among several.
  const subject = /^([^:]{1,120}): (.+)$/s.exec(text);
  if (subject) {
    const inner = serverMessage(subject[2], t);
    if (inner) return `${subject[1]} — ${inner}`;
  }
  return null;
}
