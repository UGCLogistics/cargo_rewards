# C.A.R.G.O Rewards Portal - Next.js + Supabase

This repository contains a fully-functional starting point for the **CARGO Rewards** portal built using the [Next.js App Router](https://nextjs.org/docs) and [Supabase](https://supabase.com) as the backend.  It implements the core pieces of the loyalty program (user authentication, transaction capture, reward ledger and redemption requests) and provides a solid foundation on which to build features like admin dashboards and scheduled cashback evaluation.

## 🗂 Struktur Direktori

```
cargo_rewards_nextjs/
├── app/                # App Router pages and layouts
│   ├── layout.tsx      # Root layout wrapping every page with AuthProvider
│   ├── page.tsx        # Landing page with login/register links
│   ├── login/          # Login page
│   ├── register/       # Registration page
│   └── dashboard/      # All dashboard pages
│       ├── layout.tsx  # Dashboard layout with side navigation
│       ├── page.tsx    # Dashboard home (overview)
│       ├── transactions/
│       │   ├── page.tsx      # List of transactions
│       │   ├── create/page.tsx   # Form to create a new transaction
│       │   └── import/page.tsx   # Stub page for CSV/XLSX import
│       ├── rewards/page.tsx   # Reward & ledger overview
│       └── redeem/page.tsx    # Redeem request form & history
├── app/api/           # API routes (Next.js Serverless Functions)
│   ├── transactions/route.ts  # GET/POST for transactions
│   ├── rewards/route.ts       # GET for reward ledgers
│   └── redeem/route.ts        # GET/POST for redemption requests
├── context/
│   └── AuthContext.tsx  # React context to manage Supabase auth state
├── lib/
│   └── supabaseClient.ts  # Supabase client configured for browser
├── supabase/
│   └── schema.sql      # SQL definitions & RLS policies for Supabase tables
├── middleware.ts       # Protects `/dashboard` routes by requiring a session
├── package.json        # Project metadata and dependencies
├── tsconfig.json       # TypeScript configuration
├── .env.example        # Template for environment variables
└── README.md           # You are here!
```

## 🎨 Fitur Tambahan

* **Dark glassmorphism UI dengan aksen `#ff4600`** - Tema gelap dengan efek kaca diterapkan melalui variabel CSS di `app/globals.css`. Semua permukaan (sidebar, kartu keanggotaan) menggunakan latar semi-transparan dan blur, dengan teks putih dan aksen oranye.
* **Kartu Member** - Komponen `components/MembershipCard.tsx` menampilkan nama pengguna, ID singkat, peran dan saldo poin. Komponen ini ditampilkan di sidebar pada setiap halaman dashboard dan dapat diekspor ke PNG melalui tombol di kartu.
* **Navigasi peran** - Sidebar dashboard memuat menu dinamis berdasarkan peran (`ADMIN`, `MANAGER`, `STAFF`, `CUSTOMER`). Admin memiliki modul lengkap termasuk manajemen user, tambah user, data pelanggan, konfigurasi program, membership, import transaksi, approval redeem, KPI internal dan audit log. Manager memiliki modul yang hampir sama kecuali pembuatan user/pelanggan dan import transaksi. Staff hanya dapat mengimpor transaksi dan melihat KPI internal, sedangkan Customer memiliki dashboard KPI eksternal.

* **Halaman Beranda Personalisasi** - Saat pengguna masuk ke dasbor, halaman `Home` menampilkan sapaan seperti `Hi, Nama User`, nama perusahaan, serta tanggal hari ini.  Di bawah sapaan ini terdapat ringkasan KPI berupa lima kartu (jumlah transaksi, total publish rate, total diskon, total cashback, dan total poin) yang dihitung secara otomatis dari API sesuai peran.  Di bawah ringkasan, ada tautan cepat (card) ke modul utama seperti Transaksi, Poin & Ledger, Redeem, dan KPI.

* **Informasi Akun dan Pengaturan Akun** - Modul baru di menu dashboard yang memungkinkan pengguna melihat detail akunnya dan memperbarui informasi dasar.  Halaman **Account Info** menampilkan nama, email, perusahaan, peran, status, tanggal dibuat (member since), dan waktu login terakhir.  Halaman **Pengaturan Akun** menyediakan formulir untuk mengganti kata sandi dan mengunggah foto profil (avatar) yang tersimpan di bucket `avatars` Supabase Storage.
* **Halaman modul lengkap** - Selain stub, versi ini menyediakan implementasi fungsional untuk:
  - **Manajemen User & Peran** (`/dashboard/admin/users`) - Admin dapat melihat daftar user dan mengubah peran.  Tombol baru “Tambah User” mengarahkan ke formulir pembuatan user (`/dashboard/admin/users/create`).
  - **Data Pelanggan** (`/dashboard/admin/customers`) - Admin dapat melihat dan menambah data perusahaan/pelanggan beserta PIC, NPWP, kontak dan sales.  Manager dapat melihat daftar pelanggan di `/dashboard/manager/customers`.
  - **Membership** (`/dashboard/admin/membership` dan `/dashboard/manager/membership`) - Menampilkan tier keanggotaan (Silver/Gold/Platinum) dan total poin untuk setiap user dengan opsi filter tanggal.  Manager dapat membaca laporan ini tetapi tidak mengubah data.
  - **Program Config** - Admin dapat melihat dan mengubah konfigurasi program (JSON) di `/dashboard/admin/program-config`.  Manager hanya bisa melihat konfigurasi di `/dashboard/manager/program-config` tanpa tombol simpan.
  - **Tambah User** (`/dashboard/admin/users/create`) - Formulir untuk membuat akun baru dengan email, password, nama dan peran.  Endpoint `POST /api/admin/users/create` menggunakan Supabase Admin API untuk mendaftarkan user di auth dan tabel `public.users`.
  - **Data Pelanggan & Tambah Pelanggan** - Admin dapat menambah pelanggan baru lewat formulir di halaman Data Pelanggan, sedangkan Manager hanya bisa melihat.
* **Membership & Analitik KPI** - Modul membership menghitung tier keanggotaan berdasarkan total poin (≥1000 poin = Platinum, ≥500 poin = Gold, sisanya Silver) dengan filter tanggal. KPI internal maupun eksternal memiliki grafik interaktif dengan filter tanggal, sales name dan level membership, serta opsi ekspor CSV. 

## 🚀 Langkah-langkah Setup Lengkap


### 1. Persiapan Prasyarat

1. **Node.js**: Pastikan Node.js versi 18 atau lebih baru terinstall di komputer Anda.  Cek dengan:

   ```bash
   node --version
   ```

2. **npm atau yarn**: Paket manajer untuk menginstall dependensi.  Secara default, npm sudah terpasang bersama Node.js.  Anda bisa menggunakan `npm` atau `yarn` - contoh di bawah menggunakan `npm`.

3. **Git** (opsional): Untuk meng-clone repository.  Anda juga bisa men-download ZIP dari repo ini.

4. **Akun Supabase**: Daftar di <https://supabase.com> jika belum punya.

5. **Akun Vercel** (opsional untuk deploy): Daftar di <https://vercel.com>.

### 2. Clone atau Download Repo

Jika Anda memiliki `git`, clone repository ini:

```bash
git clone https://example.com/your-repo-url.git cargo_rewards_nextjs
cd cargo_rewards_nextjs
```

Atau download ZIP dan ekstrak ke folder `cargo_rewards_nextjs`.

### 3. Install Dependensi


```bash
npm install
# atau jika menggunakan yarn
yarn install
```

### 4. Membuat Proyek Supabase

1. **Buat Project**: Masuk ke <https://app.supabase.com> dan klik **New Project**.

2. **Isi Detail**: Pilih `Organization`, beri nama misalnya `cargo-rewards`, pilih region terdekat (misal `ap-southeast-1` untuk Indonesia), masukkan password untuk database (catat password ini!).

3. **Buat Proyek**: Klik **Create New Project**.  Supabase akan membutuhkan waktu beberapa detik untuk membuat instance.

4. **Catat API Keys**: Buka tab **API** di pengaturan proyek Anda.  Di sana ada:

   - `URL`: misalnya `https://abcdefg.supabase.co` - ini menjadi `NEXT_PUBLIC_SUPABASE_URL`.
   - `anon public` key: kunci publik yang boleh di-embed di frontend - ini menjadi `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - `service_role` key: kunci dengan privilege penuh untuk operasi server-side.  *Jangan* gunakan di browser!  Ini opsional tetapi berguna untuk tugas server (misal cron job).  Masukkan ke `SUPABASE_SERVICE_ROLE` jika Anda membutuhkannya.

5. **Import Skema Basis Data**:  Klik menu **SQL Editor** → **New Query** → salin isi file [`supabase/schema.sql`](supabase/schema.sql) ke editor.  Kemudian tekan **RUN**.  Skrip ini akan membuat semua tabel (users, transactions, reward_ledgers, redemptions, dsb.) dan menerapkan kebijakan RLS dasar sehingga hanya pemilik data yang bisa melihat catatannya.

6. **Aktifkan Storage (opsional)**: Jika Anda ingin mengunggah file CSV, buatlah bucket di menu **Storage**.  File ini belum digunakan di kode tetapi menjadi dasar untuk impor massal ke depan.

7. **Testing RLS**:  Di panel **Table Editor**, coba insert baris ke tabel `transactions` melalui UI dengan kolom `user_id` diisi `auth.uid()`.  Pastikan baris muncul saat Anda query sebagai user yang sama.  Kebijakan RLS melindungi data antar user.

### 5. Konfigurasi Lingkungan Lokal

1. **Buat file env lokal**: Salin `.env.example` menjadi `.env.local` di akar proyek.

   ```bash
   cp .env.example .env.local
   ```

2. **Isi variabel** di `.env.local` dengan kredensial dari langkah Supabase:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://abcdefg.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE=your-service-role-key
   ```

3. **Jalankan server lokal**:

   ```bash
   npm run dev
   ```

   Buka <http://localhost:3000> di browser.  Anda akan melihat halaman depan portal.  Anda bisa mendaftar akun baru, login, membuat transaksi, melihat poin dan mengajukan redeem.

### 6. Penjelasan Komponen Utama

#### Autentikasi

Portal menggunakan Supabase Auth.  Komponen `AuthProvider` (lihat `context/AuthContext.tsx`) mendaftarkan listener `onAuthStateChange` sehingga perubahan sesi secara otomatis memperbarui state React.  Hal ini memungkinkan Anda mengakses `user` dan `session` di seluruh aplikasi via hook `useAuth()`.

#### Middleware Proteksi

File `middleware.ts` memeriksa sesi Supabase untuk semua rute yang diawali `/dashboard`.  Jika sesi tidak ada, pengguna diarahkan ke halaman login.  Kebijakan ini memastikan modul modul internal hanya diakses setelah login.

#### API Routes

Semua operasi data dilakukan melalui [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers).  File di bawah `app/api` berfungsi sebagai endpoint serverless yang berbicara langsung dengan Supabase menggunakan cookie sesi.  Contohnya:

- `app/api/transactions/route.ts` - menerima `GET` untuk mengambil transaksi Anda sendiri dan `POST` untuk menyimpan transaksi baru.  Fungsi helper `calculateHelloDiscount` dan `calculatePoints` menerapkan aturan promo sesuai brief: diskon 5/10/15 % untuk transaksi pertama【89546385958591†L70-L73】 dan 1 poin per Rp 10 k【89546385958591†L84-L85】.
- `app/api/rewards/route.ts` - mengambil ledger poin dan kredit Anda.
- `app/api/redeem/route.ts` - membuat permintaan redeem baru dan menampilkan daftar permintaan yang ada.

Anda dapat menambah route lain seperti `app/api/cashback/route.ts` untuk menjalankan evaluasi cashback triwulanan (lihat section **Roadmap** di bawah).

#### Halaman Dashboard

- **Transaksi** - daftar semua transaksi Anda dan tombol untuk membuat atau mengimpor transaksi.
- **Buat Transaksi** - form sederhana untuk memasukkan transaksi baru.  Data disimpan melalui API dan perhitungan diskon/poin terjadi di server.
- **Impor Transaksi** - stub untuk impor CSV/XLSX; ganti dengan logika upload ke Supabase Storage kemudian panggil API untuk memproses.
- **Poin & Ledger** - menampilkan semua mutasi poin/kredit dari tabel `reward_ledgers`.
- **Redeem** - form untuk mengajukan penukaran poin menjadi kredit pengiriman atau cash out serta daftar permintaan sebelumnya.

### 7. Deployment ke Vercel

1. **Push Kode ke Git**: Pastikan proyek ada di GitHub, GitLab, atau Bitbucket.  Jika belum, inisialisasi repository lalu push:

   ```bash
   git init
   git remote add origin git@github.com:username/cargo_rewards_nextjs.git
   git add .
   git commit -m "Initial commit"
   git push -u origin main
   ```

2. **Buat Proyek di Vercel**: Login ke Vercel → klik **New Project** → pilih repository Anda.

3. **Set Environment Variables**: Pada langkah konfigurasi, klik **Environment Variables** dan masukkan variabel yang sama seperti di `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE`).

4. **Deploy**: Klik **Deploy**.  Vercel akan mendeteksi bahwa ini adalah proyek Next.js dan otomatis menjalankan `npm install` serta `next build`.  Setelah selesai, aplikasi bisa diakses melalui domain vercel.app.

### 8. Roadmap Pengembangan

1. **Role-based Dashboard**: Gunakan `user.role` dari tabel `users` (atau metadata Supabase) untuk menampilkan modul berbeda untuk Admin, Manager, Staff, dan Customer seperti dijabarkan di matriks akses【89546385958591†L61-L63】.

2. **Impor CSV/XLSX**: Implementasikan upload file ke Supabase Storage, parse file menggunakan Serverless Function, lalu insert data ke `transactions` table.  Pastikan validasi data dilakukan sebelum insert massal.

3. **Scheduler Cashback & Tier Evaluation**: Buatlah edge function atau cron job (misal via [Supabase Scheduled Jobs](https://supabase.com/docs/guides/functions/scheduled-jobs)) untuk mengeksekusi perhitungan Active Cashback setiap 90 hari dan pembaruan tier kuartalan sesuai aturan【89546385958591†L75-L82】.  Tambahkan mutasi ke `reward_ledgers` ketika cashback selesai.

4. **Approval Redeem & Audit Logs**: Tambahkan halaman admin/manager untuk menyetujui atau menolak permintaan redeem.  Setiap aksi terekam ke tabel `audit_logs` untuk kepatuhan.

5. **Filament / Admin UI**: Untuk administrator, Anda dapat membuat antarmuka CRUD menggunakan library seperti [Refine](https://refine.dev/) atau membuat modul admin manual di Next.js.
