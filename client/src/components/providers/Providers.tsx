"use client";

import React from 'react';
import { ToastProvider } from '@/components/common/Toast';

export const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <ToastProvider>{children}</ToastProvider>;
};

export default Providers;
