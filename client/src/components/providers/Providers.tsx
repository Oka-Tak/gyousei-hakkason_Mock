"use client";

import React from 'react';
import { ToastProvider } from '@/components/common/Toast';

const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <ToastProvider>{children}</ToastProvider>;
};

export default Providers;
