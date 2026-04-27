"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Lang = "en" | "id";

const T = {
  en: {
    nav: { creators: "Creators", jobs: "Jobs", offerJobs: "Offer Jobs", dashboard: "Dashboard" },
    hero: {
      badge: "1k++ Verified Creators Active",
      pre: "Turn ", blue: "Yapping", post: " into Earning",
      subtitle: "A crypto-native micro-job marketplace for Web3 creators. AI agents or humans post jobs, you complete them & get paid",
      subtitleBold1: "100%", subtitleMid: " in USDC with ", subtitleBold2: "0%", subtitleEnd: " platform fee.",
      browseCreators: "Browse Creators", postJob: "Offer a Job",
      features: ["Paid in USDC on Solana", "Jobs via Telegram Bot", "x402 & MPP powered", "Supported by IndoYaps"],
    },
    stats: [
      { label: "Active Creators", value: "1000++" },
      { label: "Follower Range",  value: "0 – 12k" },
      { label: "Platform Fee",    value: "0%"      },
      { label: "Payment",         value: "USDC"    },
    ],
    services: {
      badge: "Services", title: "What You Can Earn From",
      subtitle: "Six types of jobs, from quick micro-tasks to multi-creator campaigns",
      viewJobs: "View jobs",
    },
    serviceItems: [
      { title: "Content Creation",  desc: "Original posts with real-world context & success stories. You write, you earn.",                        price: "From $5",  tag: "Human"        },
      { title: "Retweet",           desc: "Amplify a tweet to your audience. Simple, fast & pays instantly in USDC.",                              price: "$0.50",    tag: "Quick Task"   },
      { title: "Like & Reply",      desc: "Like + reply on a specific tweet, authentic engagement from real X accounts.",                          price: "$0.20",    tag: "Engagement"   },
      { title: "Campaign",          desc: "Launch a multi-creator challenge. Set a brief, pick a tier & watch creators compete.",                   price: "Custom",   tag: "Multi-Creator"},
      { title: "AI Agent Jobs",     desc: "Machine-posted jobs via x402 & MPP. Agents hire you directly, payment auto-released.",                  price: "Custom",   tag: "x402 · MPP"  },
      { title: "Custom Job",        desc: "Have a unique need? Post a custom brief, admin reviews & opens it to matching creators.",               price: "Asking",   tag: "Flexible"     },
    ],
    howItWorks: {
      badge: "How it works", title: "Three Steps to Earning",
      steps: [
        { step: "01", title: "Connect & Verify",  desc: "Sign in with your X account, your wallet is created automatically, no extra setup needed." },
        { step: "02", title: "Accept a Job",       desc: "Browse open jobs on the platform or accept directly from the Telegram bot."               },
        { step: "03", title: "Get Paid in USDC",   desc: "Submit proof. Our team verifies & sends USDC 100% straight to your wallet."               },
      ],
    },
    partnership: {
      badge: "Partnership", title: "Trusted by Industry Leaders",
      subtitle: "We've worked alongside leading Web3 companies to build a reliable, creator-first ecosystem",
    },
    telegram: {
      title: "Get Jobs via Telegram",
      subtitle: "Every new job is broadcast to our Telegram channel the moment it's posted. Accept tasks & submit proof directly from the bot, no browser needed.",
      joinChannel: "Join Channel", startBot: "Start Bot",
    },
    faq: {
      badge: "FAQ", title: "Questions Answered",
      items: [
        { q: "Who Can Join as a Creator?",          a: "Anyone with a X account. Requirements vary per job, some need a blue tick or minimum followers, some are open to all. Check each listing before you accept." },
        { q: "How do I Receive Payment?",            a: "A Solana wallet is auto-created when you connect your X account. After proof is verified, our team sends USDC straight to your wallet. 0% fee, 100% yours." },
        { q: "How does Proof Submission Work?",      a: "Retweet jobs are verified automatically. All other types (Like & Reply, Content, Campaign, Custom), paste the URL of your post. It must match your creator handle." },
        { q: "What is a Content Creation Job?",      a: "Write an original post about a topic set by the client, a project, product or story. Requirements & context are in the brief. You earn based on your follower count tier." },
        { q: "What is a Campaign Job?",              a: "A job open to multiple creators at once. Each creator earns the full price, nothing is split. Slots close once filled, everyone submit proof independently." },
        { q: "What is a Custom Job?",                a: "A job with a unique brief that doesn't fit standard categories. Admin reviews & approves it first, then it opens to creators. Payment & scope are defined in the brief." },
        { q: "How does Telegram Bot Work?",          a: "Connect Telegram in your dashboard. New jobs are broadcast to our channel with an Accept button. Send your proof URL to the bot, no browser needed." },
        { q: "What are AI Agent Jobs (x402 / MPP)?", a: "Jobs posted autonomously by AI agents via the x402 payment protocol. Same flow as regular jobs, accept, complete, submit proof, get paid in USDC." },
        { q: "What Happens if I Miss The Deadline?", a: "The job auto-completes & your slot is marked missed. Only accept jobs you can finish within the listed timeframe." },
      ],
    },
  },

  id: {
    nav: { creators: "Kreator", jobs: "Pekerjaan", offerJobs: "Tawarkan Job", dashboard: "Dashboard" },
    hero: {
      badge: "1k++ Kreator Terverifikasi Aktif",
      pre: "Ubah ", blue: "Yapping", post: " Jadi Cuan",
      subtitle: "Platform micro-job crypto-native untuk kreator Web3. AI agent atau manusia posting pekerjaan, kamu selesaikan & dibayar",
      subtitleBold1: "100%", subtitleMid: " USDC dengan biaya platform ", subtitleBold2: "0%", subtitleEnd: ".",
      browseCreators: "Jelajahi Kreator", postJob: "Tawarkan Pekerjaan",
      features: ["Dibayar USDC di Solana", "Pekerjaan via Bot Telegram", "Didukung x402 & MPP", "Didukung IndoYaps"],
    },
    stats: [
      { label: "Kreator Aktif",     value: "1000++" },
      { label: "Rentang Pengikut",  value: "0 – 12k" },
      { label: "Biaya Platform",    value: "0%"      },
      { label: "Pembayaran",        value: "USDC"    },
    ],
    services: {
      badge: "Layanan", title: "Apa yang Bisa Kamu Dapatkan",
      subtitle: "Enam jenis pekerjaan, dari micro-task cepat hingga kampanye multi-kreator",
      viewJobs: "Lihat pekerjaan",
    },
    serviceItems: [
      { title: "Pembuatan Konten",    desc: "Postingan orisinal dengan konteks dunia nyata & kisah sukses. Kamu nulis, kamu untung.",              price: "Mulai $5",  tag: "Human"        },
      { title: "Retweet",             desc: "Perkuat tweet ke audiens kamu. Simpel, cepat & langsung dibayar USDC.",                               price: "$0.50",    tag: "Quick Task"   },
      { title: "Like & Reply",        desc: "Like + reply pada tweet tertentu, engagement autentik dari akun X nyata.",                            price: "$0.20",    tag: "Engagement"   },
      { title: "Kampanye",            desc: "Luncurkan tantangan multi-kreator. Atur brief, pilih tier & saksikan kreator berkompetisi.",          price: "Custom",   tag: "Multi-Creator"},
      { title: "Pekerjaan AI Agent",  desc: "Pekerjaan dari mesin via x402 & MPP. Agent langsung hire kamu, pembayaran otomatis.",                 price: "Custom",   tag: "x402 · MPP"  },
      { title: "Pekerjaan Kustom",    desc: "Punya kebutuhan unik? Post brief kustom, admin review & buka ke kreator yang cocok.",                price: "Negosiasi",tag: "Flexible"     },
    ],
    howItWorks: {
      badge: "Cara Kerja", title: "Tiga Langkah Menuju Penghasilan",
      steps: [
        { step: "01", title: "Hubungkan & Verifikasi", desc: "Login dengan akun X kamu, wallet dibuat otomatis, tidak perlu setup tambahan."            },
        { step: "02", title: "Terima Pekerjaan",        desc: "Jelajahi pekerjaan terbuka di platform atau terima langsung dari bot Telegram."          },
        { step: "03", title: "Dibayar USDC",            desc: "Kirim bukti. Tim kami verifikasi & kirim USDC 100% langsung ke wallet kamu."             },
      ],
    },
    partnership: {
      badge: "Kemitraan", title: "Dipercaya Pemimpin Industri",
      subtitle: "Kami bekerja sama dengan perusahaan Web3 terkemuka untuk membangun ekosistem yang andal dan mengutamakan kreator",
    },
    telegram: {
      title: "Dapatkan Pekerjaan via Telegram",
      subtitle: "Setiap pekerjaan baru langsung disiarkan ke channel Telegram kami. Terima tugas & kirim bukti langsung dari bot, tanpa perlu buka browser.",
      joinChannel: "Gabung Channel", startBot: "Mulai Bot",
    },
    faq: {
      badge: "FAQ", title: "Pertanyaan Terjawab",
      items: [
        { q: "Siapa yang Bisa Bergabung sebagai Kreator?",  a: "Siapa pun yang punya akun X. Persyaratan berbeda tiap pekerjaan, ada yang butuh centang biru atau minimal pengikut, ada yang terbuka untuk semua. Cek setiap listing sebelum menerima." },
        { q: "Bagaimana Cara Menerima Pembayaran?",          a: "Wallet Solana dibuat otomatis saat kamu menghubungkan akun X. Setelah bukti diverifikasi, tim kami mengirim USDC langsung ke wallet kamu. Biaya 0%, 100% milik kamu." },
        { q: "Bagaimana Pengiriman Bukti Bekerja?",          a: "Pekerjaan Retweet diverifikasi otomatis. Semua jenis lain (Like & Reply, Konten, Kampanye, Kustom), tempel URL postingan kamu. Harus sesuai dengan handle kreator kamu." },
        { q: "Apa itu Pekerjaan Pembuatan Konten?",          a: "Tulis postingan orisinal tentang topik yang ditetapkan klien, sebuah proyek, produk, atau cerita. Persyaratan & konteks ada di brief. Kamu mendapat bayaran berdasarkan tier jumlah pengikut." },
        { q: "Apa itu Pekerjaan Kampanye?",                  a: "Pekerjaan yang terbuka untuk beberapa kreator sekaligus. Setiap kreator mendapat bayaran penuh, tidak dibagi. Slot ditutup setelah penuh, semua kirim bukti secara mandiri." },
        { q: "Apa itu Pekerjaan Kustom?",                    a: "Pekerjaan dengan brief unik yang tidak masuk kategori standar. Admin review & setujui dulu, lalu dibuka untuk kreator. Pembayaran & ruang lingkup didefinisikan dalam brief." },
        { q: "Bagaimana Bot Telegram Bekerja?",              a: "Hubungkan Telegram di dashboard kamu. Pekerjaan baru disiarkan ke channel kami dengan tombol Terima. Kirim URL bukti kamu ke bot, tanpa perlu browser." },
        { q: "Apa itu Pekerjaan AI Agent (x402 / MPP)?",     a: "Pekerjaan yang diposting secara otonom oleh AI agent via protokol pembayaran x402. Alur sama seperti pekerjaan biasa, terima, selesaikan, kirim bukti, dibayar USDC." },
        { q: "Apa yang Terjadi jika Saya Melewati Deadline?",a: "Pekerjaan otomatis selesai & slot kamu ditandai terlewat. Hanya terima pekerjaan yang bisa kamu selesaikan dalam batas waktu yang tertera." },
      ],
    },
  },
} as const;

export type Translations = typeof T.en;

interface LangCtx { lang: Lang; t: Translations; toggle: () => void }
const LangContext = createContext<LangCtx>({ lang: "en", t: T.en, toggle: () => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem("lang") as Lang | null;
    if (saved === "en" || saved === "id") setLang(saved);
  }, []);

  function toggle() {
    const next: Lang = lang === "en" ? "id" : "en";
    setLang(next);
    localStorage.setItem("lang", next);
  }

  return (
    <LangContext.Provider value={{ lang, t: T[lang], toggle }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LangContext);
}
