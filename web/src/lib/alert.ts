/**
 * Web replacement for React Native's Alert.alert(title, message).
 *
 * A UI layer (e.g. a toast/modal provider) can register a handler via
 * setAlertHandler(); until then we fall back to the native browser dialog so
 * no message is ever silently dropped.
 */

type AlertHandler = (title: string, message?: string) => void;

let handler: AlertHandler | null = null;

export function setAlertHandler(fn: AlertHandler | null): void {
  handler = fn;
}

export const Alert = {
  alert(title: string, message?: string): void {
    if (handler) {
      handler(title, message);
      return;
    }
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(message ? `${title}\n\n${message}` : title);
    }
  },
};
