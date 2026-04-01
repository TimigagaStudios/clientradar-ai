import { useToastContext } from './ToastProvider';

export const useToast = () => {
  return useToastContext();
};
