"use client";

import { useAuth } from '../../../../context/AuthContext';
import DashboardLayout from '../../layout';
import supabase from '../../../../lib/supabaseClient';
import { useState } from 'react';

/**
 * AccountSettingsPage provides forms to change the user's password and
 * update their profile picture. Password changes are done via
 * supabase.auth.updateUser, while avatar uploads are saved to the
 * `avatars` bucket in Supabase Storage and the resulting public URL
 * stored in the user metadata. This page is accessible to all
 * authenticated roles.
 */
export default function AccountSettingsPage() {
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Handle password update
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);
    if (newPassword !== confirmPassword) {
      setPasswordMessage('Password baru dan konfirmasi tidak cocok');
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordMessage(error.message);
      } else {
        setPasswordMessage('Password berhasil diperbarui');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setPasswordMessage(err.message);
    }
  };

  // Handle avatar upload
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setAvatarMessage(null);
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}.${fileExt}`;
      // Upload to avatars bucket under public/ folder to make it public
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(`public/${fileName}`, file, { upsert: true });
      if (uploadError) throw uploadError;
      // Retrieve the public URL
      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(`public/${fileName}`);
      const avatarUrl = publicUrlData?.publicUrl;
      // Update user metadata with new avatar URL
      const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } });
      if (updateError) throw updateError;
      setAvatarMessage('Foto profil berhasil diperbarui');
    } catch (err: any) {
      setAvatarMessage(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <h1>Pengaturan Akun</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
        {/* Password change form */}
        <div className="glass" style={{ padding: '1rem', borderRadius: '8px', minWidth: '280px' }}>
          <h2>Ubah Password</h2>
          <form onSubmit={handlePasswordSubmit}>
            <div style={{ marginBottom: '0.5rem' }}>
              <label htmlFor="new-password">Password Baru</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ display: 'block', width: '100%' }}
              />
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label htmlFor="confirm-password">Konfirmasi Password</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ display: 'block', width: '100%' }}
              />
            </div>
            <button type="submit" style={{ marginTop: '0.5rem' }}>Perbarui Password</button>
            {passwordMessage && <p style={{ marginTop: '0.5rem', color: passwordMessage.includes('berhasil') ? 'green' : 'red' }}>{passwordMessage}</p>}
          </form>
        </div>
        {/* Avatar upload */}
        <div className="glass" style={{ padding: '1rem', borderRadius: '8px', minWidth: '280px' }}>
          <h2>Foto Profil</h2>
          <input type="file" accept="image/*" onChange={handleAvatarChange} disabled={uploading} />
          {avatarMessage && <p style={{ marginTop: '0.5rem', color: avatarMessage.includes('berhasil') ? 'green' : 'red' }}>{avatarMessage}</p>}
        </div>
      </div>
    </DashboardLayout>
  );
}