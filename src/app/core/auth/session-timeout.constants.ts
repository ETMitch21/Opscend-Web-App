export const SESSION_LAST_ACTIVITY_KEY = 'px_last_activity_at';
export const SESSION_SUPPRESS_RESTORE_KEY = 'px_suppress_session_restore';
export const SESSION_MANUAL_LOCK_KEY = 'px_session_locked_at';

// Centralized defaults so they can later be moved into shop-level settings
// without changing the lock/logout behavior itself.
export const SESSION_LOCK_AFTER_MS = 15 * 60 * 1000;
export const SESSION_LOGOUT_AFTER_MS = 60 * 60 * 1000;
