'use client';

import { useState } from 'react';
import AdminDashboard from '@/components/AdminDashboard';

export default function AdminPage() {
  return (
    <AdminDashboard onClose={() => {
      // Voltar pra home
      window.location.href = '/';
    }} />
  );
}
