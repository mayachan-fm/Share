export async function ambilNotifikasi(user) {
  if (!user) return [];
  const token = await user.getIdToken();
  const response = await fetch('/api/notifications', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store'
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok !== true) throw new Error(result.error || 'Gagal memuat notifikasi.');
  return Array.isArray(result.notifications) ? result.notifications : [];
}

export async function tandaiSemuaNotifikasiDibaca(user) {
  if (!user) return {updated:0};
  const token = await user.getIdToken();
  const response = await fetch('/api/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({action:'readAll'})
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok !== true) throw new Error(result.error || 'Gagal menandai notifikasi.');
  return result;
}

// Hapus satu notifikasi milik user yang sedang login (mis. pengumuman yang sudah dibaca).
// Server-side (action=delete di /api/notifications) agar aman dan tidak perlu
// menulis langsung ke RTDB dari client.
export async function hapusNotifikasi(user, id) {
  if (!user || !id) throw new Error('Data tidak lengkap.');
  const token = await user.getIdToken();
  const response = await fetch('/api/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ action: 'delete', id })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok !== true) throw new Error(result.error || 'Gagal menghapus notifikasi.');
  return result;
}

export function jumlahNotifikasiBelumDibaca(list) {
  return Array.isArray(list) ? list.filter(item => !item?.dibaca).length : 0;
}
