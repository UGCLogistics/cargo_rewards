"use client";

import { useEffect, useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { useAuth } from '../context/AuthContext';
import supabase from '../lib/supabaseClient';

/**
 * MembershipCard displays the logged in user's basic profile along with
 * their current point balance. It adopts a dark glassmorphism style
 * using CSS variables defined in globals.css. If you implement tier
 * tracking via the `tier_snapshots` table, you can extend this
 * component to show the user’s current tier and multiplier.
 */
export default function MembershipCard() {
  const { user } = useAuth();
  const [points, setPoints] = useState<number>(0);
  const [exporting, setExporting] = useState(false);
  const [profile, setProfile] = useState<any | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Load total points for the current user
  useEffect(() => {
    const loadPoints = async () => {
      try {
        const res = await fetch('/api/rewards');
        if (!res.ok) return;
        const json = await res.json();
        const total = (json.data || []).reduce((sum: number, item: any) => sum + (item.points || 0), 0);
        setPoints(total);
      } catch (e) {
        // ignore network errors
      }
    };
    if (user) loadPoints();
  }, [user]);

  // Load extended profile (companyname and created_at) from Supabase 'users' table
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase.from('users').select('*').eq('id', user.id).single();
        if (!error) setProfile(data);
      } catch {
        // ignore errors
      }
    };
    loadProfile();
  }, [user]);

  if (!user) return null;
  const metadata = user.user_metadata || {};
  const name = metadata.name || user.email;
  const role = metadata.role || 'CUSTOMER';
  const company = profile?.companyname || metadata.companyname || '-';
  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '-';
  // compute membership tier based on point thresholds
  let tier = 'Silver';
  if (points >= 1000) tier = 'Platinum';
  else if (points >= 500) tier = 'Gold';
  const tierColor = tier === 'Platinum' ? '#e5e4e2' : tier === 'Gold' ? '#d4af37' : '#c0c0c0';
  // Use the first 8 characters of the UUID as a membership ID for display
  const id = user.id?.substring(0, 8).toUpperCase();
  // Handler to export the card to a PNG image
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const element = cardRef.current;
      if (!element) return;
      const canvas = await html2canvas(element, { backgroundColor: null });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `membership_card_${id}.png`;
      link.click();
    } catch (e) {
      console.error('Failed to export card', e);
    } finally {
      setExporting(false);
    }
  };
  return (
    <div>
      <div
        ref={cardRef}
        className="glass"
        style={{
          padding: '1rem',
          borderRadius: '12px',
          marginBottom: '0.5rem',
          color: 'var(--text)',
          border: `2px solid ${tierColor}`,
        }}
      >
        {/* UGC logo placeholder */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>UGC LOGISTICS</span>
          {/* Badge representing membership tier */}
          <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{tier}</span>
        </div>
        <h3 style={{ margin: '0 0 0.25rem 0' }}>{name}</h3>
        <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem' }}>Perusahaan: {company}</p>
        <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem' }}>ID: {id}</p>
        <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem' }}>Peran: {role}</p>
        <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem' }}>Member sejak: {memberSince}</p>
        <p style={{ margin: '0', fontSize: '0.85rem' }}>
          Saldo Poin: <span style={{ color: 'var(--accent)' }}>{points}</span>
        </p>
      </div>
      <button onClick={handleExport} disabled={exporting} style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem' }}>
        {exporting ? 'Mengekspor…' : 'Unduh Kartu PNG'}
      </button>
    </div>
  );
}