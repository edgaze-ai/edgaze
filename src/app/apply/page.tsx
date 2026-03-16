"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Search,
  PauseCircle,
  X,
  AlertCircle,
} from "lucide-react";
import TurnstileWidget from "../../components/apply/TurnstileWidget";
import ApplyAuthPanel from "../../components/apply/ApplyAuthPanel";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { useAuth } from "../../components/auth/AuthContext";

function cn(...args: Array<string | false | null | undefined>) {
  return args.filter(Boolean).join(" ");
}

function Gradients() {
  return (
    <>
      <div className="fixed inset-0 -z-10 bg-[#07080b]" />
      <div className="fixed inset-0 -z-10 opacity-70 [background-image:radial-gradient(circle_at_18%_10%,rgba(34,211,238,0.22),transparent_46%),radial-gradient(circle_at_82%_18%,rgba(236,72,153,0.18),transparent_46%),radial-gradient(circle_at_55%_90%,rgba(34,211,238,0.08),transparent_52%)]" />
      <div className="fixed inset-0 -z-10 opacity-[0.10] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:92px_92px]" />
    </>
  );
}

function AccentLine() {
  return (
    <div className="h-[2px] w-full bg-[linear-gradient(90deg,rgba(34,211,238,0.95),rgba(236,72,153,0.9))]" />
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-[#0b0c11] ring-1 ring-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.55)] overflow-hidden">
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold tracking-widest text-white/55">{children}</div>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white",
        "placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20",
        props.className,
      )}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white",
        "placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20",
        props.className,
      )}
    />
  );
}

function Option({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full text-left rounded-2xl px-4 py-4 ring-1 transition-all",
        selected
          ? "bg-white/10 ring-white/20 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_0_45px_rgba(34,211,238,0.10)]"
          : "bg-white/5 ring-white/10 hover:bg-white/7",
      )}
    >
      {selected ? (
        <>
          <div className="pointer-events-none absolute inset-0 rounded-2xl p-[1px] bg-[linear-gradient(135deg,rgba(34,211,238,0.9),rgba(236,72,153,0.85))]" />
          <div className="absolute right-3 top-3 rounded-full bg-white/10 ring-1 ring-white/15 px-3 py-1 text-xs text-white/80">
            Selected
          </div>
        </>
      ) : null}
      <div className="relative text-sm text-white/85 leading-snug pr-24">{children}</div>
    </button>
  );
}

function PrimaryButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group relative inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white",
        disabled ? "opacity-60 cursor-not-allowed" : "hover:opacity-[0.98]",
      )}
    >
      <span className="absolute inset-0 rounded-2xl p-[1px] bg-[linear-gradient(135deg,rgba(34,211,238,0.92),rgba(236,72,153,0.88))]" />
      <span className="absolute inset-[1px] rounded-2xl bg-[#0b0c11]" />
      <span className="relative inline-flex items-center gap-2">
        {children}
        <ArrowRight className="h-4 w-4 opacity-90 transition-transform duration-300 group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-white/90 bg-white/5 ring-1 ring-white/10 hover:bg-white/8 transition-colors"
    >
      {children}
    </button>
  );
}

const COUNTRY_CODES = [
  { value: "AF", code: "+93", label: "🇦🇫 Afghanistan (+93)" },
  { value: "AL", code: "+355", label: "🇦🇱 Albania (+355)" },
  { value: "DZ", code: "+213", label: "🇩🇿 Algeria (+213)" },
  { value: "AD", code: "+376", label: "🇦🇩 Andorra (+376)" },
  { value: "AO", code: "+244", label: "🇦🇴 Angola (+244)" },
  { value: "AR", code: "+54", label: "🇦🇷 Argentina (+54)" },
  { value: "AM", code: "+374", label: "🇦🇲 Armenia (+374)" },
  { value: "AU", code: "+61", label: "🇦🇺 Australia (+61)" },
  { value: "AT", code: "+43", label: "🇦🇹 Austria (+43)" },
  { value: "AZ", code: "+994", label: "🇦🇿 Azerbaijan (+994)" },
  { value: "BH", code: "+973", label: "🇧🇭 Bahrain (+973)" },
  { value: "BD", code: "+880", label: "🇧🇩 Bangladesh (+880)" },
  { value: "BY", code: "+375", label: "🇧🇾 Belarus (+375)" },
  { value: "BE", code: "+32", label: "🇧🇪 Belgium (+32)" },
  { value: "BZ", code: "+501", label: "🇧🇿 Belize (+501)" },
  { value: "BJ", code: "+229", label: "🇧🇯 Benin (+229)" },
  { value: "BT", code: "+975", label: "🇧🇹 Bhutan (+975)" },
  { value: "BO", code: "+591", label: "🇧🇴 Bolivia (+591)" },
  { value: "BA", code: "+387", label: "🇧🇦 Bosnia and Herzegovina (+387)" },
  { value: "BW", code: "+267", label: "🇧🇼 Botswana (+267)" },
  { value: "BR", code: "+55", label: "🇧🇷 Brazil (+55)" },
  { value: "BN", code: "+673", label: "🇧🇳 Brunei (+673)" },
  { value: "BG", code: "+359", label: "🇧🇬 Bulgaria (+359)" },
  { value: "BF", code: "+226", label: "🇧🇫 Burkina Faso (+226)" },
  { value: "BI", code: "+257", label: "🇧🇮 Burundi (+257)" },
  { value: "KH", code: "+855", label: "🇰🇭 Cambodia (+855)" },
  { value: "CM", code: "+237", label: "🇨🇲 Cameroon (+237)" },
  { value: "CA", code: "+1", label: "🇨🇦 Canada (+1)" },
  { value: "CV", code: "+238", label: "🇨🇻 Cape Verde (+238)" },
  { value: "CF", code: "+236", label: "🇨🇫 Central African Republic (+236)" },
  { value: "TD", code: "+235", label: "🇹🇩 Chad (+235)" },
  { value: "CL", code: "+56", label: "🇨🇱 Chile (+56)" },
  { value: "CN", code: "+86", label: "🇨🇳 China (+86)" },
  { value: "CO", code: "+57", label: "🇨🇴 Colombia (+57)" },
  { value: "KM", code: "+269", label: "🇰🇲 Comoros (+269)" },
  { value: "CG", code: "+242", label: "🇨🇬 Congo (+242)" },
  { value: "CD", code: "+243", label: "🇨🇩 Congo (DRC) (+243)" },
  { value: "CR", code: "+506", label: "🇨🇷 Costa Rica (+506)" },
  { value: "HR", code: "+385", label: "🇭🇷 Croatia (+385)" },
  { value: "CU", code: "+53", label: "🇨🇺 Cuba (+53)" },
  { value: "CY", code: "+357", label: "🇨🇾 Cyprus (+357)" },
  { value: "CZ", code: "+420", label: "🇨🇿 Czech Republic (+420)" },
  { value: "DK", code: "+45", label: "🇩🇰 Denmark (+45)" },
  { value: "DJ", code: "+253", label: "🇩🇯 Djibouti (+253)" },
  { value: "EC", code: "+593", label: "🇪🇨 Ecuador (+593)" },
  { value: "EG", code: "+20", label: "🇪🇬 Egypt (+20)" },
  { value: "SV", code: "+503", label: "🇸🇻 El Salvador (+503)" },
  { value: "GQ", code: "+240", label: "🇬🇶 Equatorial Guinea (+240)" },
  { value: "ER", code: "+291", label: "🇪🇷 Eritrea (+291)" },
  { value: "EE", code: "+372", label: "🇪🇪 Estonia (+372)" },
  { value: "SZ", code: "+268", label: "🇸🇿 Eswatini (+268)" },
  { value: "ET", code: "+251", label: "🇪🇹 Ethiopia (+251)" },
  { value: "FJ", code: "+679", label: "🇫🇯 Fiji (+679)" },
  { value: "FI", code: "+358", label: "🇫🇮 Finland (+358)" },
  { value: "FR", code: "+33", label: "🇫🇷 France (+33)" },
  { value: "GA", code: "+241", label: "🇬🇦 Gabon (+241)" },
  { value: "GM", code: "+220", label: "🇬🇲 Gambia (+220)" },
  { value: "GE", code: "+995", label: "🇬🇪 Georgia (+995)" },
  { value: "DE", code: "+49", label: "🇩🇪 Germany (+49)" },
  { value: "GH", code: "+233", label: "🇬🇭 Ghana (+233)" },
  { value: "GR", code: "+30", label: "🇬🇷 Greece (+30)" },
  { value: "GT", code: "+502", label: "🇬🇹 Guatemala (+502)" },
  { value: "GN", code: "+224", label: "🇬🇳 Guinea (+224)" },
  { value: "GW", code: "+245", label: "🇬🇼 Guinea-Bissau (+245)" },
  { value: "GY", code: "+592", label: "🇬🇾 Guyana (+592)" },
  { value: "HT", code: "+509", label: "🇭🇹 Haiti (+509)" },
  { value: "HN", code: "+504", label: "🇭🇳 Honduras (+504)" },
  { value: "HK", code: "+852", label: "🇭🇰 Hong Kong (+852)" },
  { value: "HU", code: "+36", label: "🇭🇺 Hungary (+36)" },
  { value: "IS", code: "+354", label: "🇮🇸 Iceland (+354)" },
  { value: "IN", code: "+91", label: "🇮🇳 India (+91)" },
  { value: "ID", code: "+62", label: "🇮🇩 Indonesia (+62)" },
  { value: "IR", code: "+98", label: "🇮🇷 Iran (+98)" },
  { value: "IQ", code: "+964", label: "🇮🇶 Iraq (+964)" },
  { value: "IE", code: "+353", label: "🇮🇪 Ireland (+353)" },
  { value: "IL", code: "+972", label: "🇮🇱 Israel (+972)" },
  { value: "IT", code: "+39", label: "🇮🇹 Italy (+39)" },
  { value: "CI", code: "+225", label: "🇨🇮 Ivory Coast (+225)" },
  { value: "JP", code: "+81", label: "🇯🇵 Japan (+81)" },
  { value: "JO", code: "+962", label: "🇯🇴 Jordan (+962)" },
  { value: "KZ", code: "+7", label: "🇰🇿 Kazakhstan (+7)" },
  { value: "KE", code: "+254", label: "🇰🇪 Kenya (+254)" },
  { value: "KI", code: "+686", label: "🇰🇮 Kiribati (+686)" },
  { value: "XK", code: "+383", label: "🇽🇰 Kosovo (+383)" },
  { value: "KW", code: "+965", label: "🇰🇼 Kuwait (+965)" },
  { value: "KG", code: "+996", label: "🇰🇬 Kyrgyzstan (+996)" },
  { value: "LA", code: "+856", label: "🇱🇦 Laos (+856)" },
  { value: "LV", code: "+371", label: "🇱🇻 Latvia (+371)" },
  { value: "LB", code: "+961", label: "🇱🇧 Lebanon (+961)" },
  { value: "LS", code: "+266", label: "🇱🇸 Lesotho (+266)" },
  { value: "LR", code: "+231", label: "🇱🇷 Liberia (+231)" },
  { value: "LY", code: "+218", label: "🇱🇾 Libya (+218)" },
  { value: "LI", code: "+423", label: "🇱🇮 Liechtenstein (+423)" },
  { value: "LT", code: "+370", label: "🇱🇹 Lithuania (+370)" },
  { value: "LU", code: "+352", label: "🇱🇺 Luxembourg (+352)" },
  { value: "MO", code: "+853", label: "🇲🇴 Macau (+853)" },
  { value: "MK", code: "+389", label: "🇲🇰 North Macedonia (+389)" },
  { value: "MG", code: "+261", label: "🇲🇬 Madagascar (+261)" },
  { value: "MW", code: "+265", label: "🇲🇼 Malawi (+265)" },
  { value: "MY", code: "+60", label: "🇲🇾 Malaysia (+60)" },
  { value: "MV", code: "+960", label: "🇲🇻 Maldives (+960)" },
  { value: "ML", code: "+223", label: "🇲🇱 Mali (+223)" },
  { value: "MT", code: "+356", label: "🇲🇹 Malta (+356)" },
  { value: "MH", code: "+692", label: "🇲🇭 Marshall Islands (+692)" },
  { value: "MR", code: "+222", label: "🇲🇷 Mauritania (+222)" },
  { value: "MU", code: "+230", label: "🇲🇺 Mauritius (+230)" },
  { value: "MX", code: "+52", label: "🇲🇽 Mexico (+52)" },
  { value: "FM", code: "+691", label: "🇫🇲 Micronesia (+691)" },
  { value: "MD", code: "+373", label: "🇲🇩 Moldova (+373)" },
  { value: "MC", code: "+377", label: "🇲🇨 Monaco (+377)" },
  { value: "MN", code: "+976", label: "🇲🇳 Mongolia (+976)" },
  { value: "ME", code: "+382", label: "🇲🇪 Montenegro (+382)" },
  { value: "MA", code: "+212", label: "🇲🇦 Morocco (+212)" },
  { value: "MZ", code: "+258", label: "🇲🇿 Mozambique (+258)" },
  { value: "MM", code: "+95", label: "🇲🇲 Myanmar (+95)" },
  { value: "NA", code: "+264", label: "🇳🇦 Namibia (+264)" },
  { value: "NR", code: "+674", label: "🇳🇷 Nauru (+674)" },
  { value: "NP", code: "+977", label: "🇳🇵 Nepal (+977)" },
  { value: "NL", code: "+31", label: "🇳🇱 Netherlands (+31)" },
  { value: "NZ", code: "+64", label: "🇳🇿 New Zealand (+64)" },
  { value: "NI", code: "+505", label: "🇳🇮 Nicaragua (+505)" },
  { value: "NE", code: "+227", label: "🇳🇪 Niger (+227)" },
  { value: "NG", code: "+234", label: "🇳🇬 Nigeria (+234)" },
  { value: "KP", code: "+850", label: "🇰🇵 North Korea (+850)" },
  { value: "NO", code: "+47", label: "🇳🇴 Norway (+47)" },
  { value: "OM", code: "+968", label: "🇴🇲 Oman (+968)" },
  { value: "PK", code: "+92", label: "🇵🇰 Pakistan (+92)" },
  { value: "PW", code: "+680", label: "🇵🇼 Palau (+680)" },
  { value: "PS", code: "+970", label: "🇵🇸 Palestine (+970)" },
  { value: "PA", code: "+507", label: "🇵🇦 Panama (+507)" },
  { value: "PG", code: "+675", label: "🇵🇬 Papua New Guinea (+675)" },
  { value: "PY", code: "+595", label: "🇵🇾 Paraguay (+595)" },
  { value: "PE", code: "+51", label: "🇵🇪 Peru (+51)" },
  { value: "PH", code: "+63", label: "🇵🇭 Philippines (+63)" },
  { value: "PL", code: "+48", label: "🇵🇱 Poland (+48)" },
  { value: "PT", code: "+351", label: "🇵🇹 Portugal (+351)" },
  { value: "QA", code: "+974", label: "🇶🇦 Qatar (+974)" },
  { value: "RO", code: "+40", label: "🇷🇴 Romania (+40)" },
  { value: "RU", code: "+7", label: "🇷🇺 Russia (+7)" },
  { value: "RW", code: "+250", label: "🇷🇼 Rwanda (+250)" },
  { value: "WS", code: "+685", label: "🇼🇸 Samoa (+685)" },
  { value: "SM", code: "+378", label: "🇸🇲 San Marino (+378)" },
  { value: "ST", code: "+239", label: "🇸🇹 Sao Tome and Principe (+239)" },
  { value: "SA", code: "+966", label: "🇸🇦 Saudi Arabia (+966)" },
  { value: "SN", code: "+221", label: "🇸🇳 Senegal (+221)" },
  { value: "RS", code: "+381", label: "🇷🇸 Serbia (+381)" },
  { value: "SC", code: "+248", label: "🇸🇨 Seychelles (+248)" },
  { value: "SL", code: "+232", label: "🇸🇱 Sierra Leone (+232)" },
  { value: "SG", code: "+65", label: "🇸🇬 Singapore (+65)" },
  { value: "SK", code: "+421", label: "🇸🇰 Slovakia (+421)" },
  { value: "SI", code: "+386", label: "🇸🇮 Slovenia (+386)" },
  { value: "SB", code: "+677", label: "🇸🇧 Solomon Islands (+677)" },
  { value: "SO", code: "+252", label: "🇸🇴 Somalia (+252)" },
  { value: "ZA", code: "+27", label: "🇿🇦 South Africa (+27)" },
  { value: "KR", code: "+82", label: "🇰🇷 South Korea (+82)" },
  { value: "SS", code: "+211", label: "🇸🇸 South Sudan (+211)" },
  { value: "ES", code: "+34", label: "🇪🇸 Spain (+34)" },
  { value: "LK", code: "+94", label: "🇱🇰 Sri Lanka (+94)" },
  { value: "SD", code: "+249", label: "🇸🇩 Sudan (+249)" },
  { value: "SR", code: "+597", label: "🇸🇷 Suriname (+597)" },
  { value: "SE", code: "+46", label: "🇸🇪 Sweden (+46)" },
  { value: "CH", code: "+41", label: "🇨🇭 Switzerland (+41)" },
  { value: "SY", code: "+963", label: "🇸🇾 Syria (+963)" },
  { value: "TW", code: "+886", label: "🇹🇼 Taiwan (+886)" },
  { value: "TJ", code: "+992", label: "🇹🇯 Tajikistan (+992)" },
  { value: "TZ", code: "+255", label: "🇹🇿 Tanzania (+255)" },
  { value: "TH", code: "+66", label: "🇹🇭 Thailand (+66)" },
  { value: "TL", code: "+670", label: "🇹🇱 Timor-Leste (+670)" },
  { value: "TG", code: "+228", label: "🇹🇬 Togo (+228)" },
  { value: "TO", code: "+676", label: "🇹🇴 Tonga (+676)" },
  { value: "TN", code: "+216", label: "🇹🇳 Tunisia (+216)" },
  { value: "TR", code: "+90", label: "🇹🇷 Turkey (+90)" },
  { value: "TM", code: "+993", label: "🇹🇲 Turkmenistan (+993)" },
  { value: "TV", code: "+688", label: "🇹🇻 Tuvalu (+688)" },
  { value: "UG", code: "+256", label: "🇺🇬 Uganda (+256)" },
  { value: "UA", code: "+380", label: "🇺🇦 Ukraine (+380)" },
  { value: "AE", code: "+971", label: "🇦🇪 United Arab Emirates (+971)" },
  { value: "GB", code: "+44", label: "🇬🇧 United Kingdom (+44)" },
  { value: "US", code: "+1", label: "🇺🇸 United States (+1)" },
  { value: "UY", code: "+598", label: "🇺🇾 Uruguay (+598)" },
  { value: "UZ", code: "+998", label: "🇺🇿 Uzbekistan (+998)" },
  { value: "VU", code: "+678", label: "🇻🇺 Vanuatu (+678)" },
  { value: "VA", code: "+379", label: "🇻🇦 Vatican City (+379)" },
  { value: "VE", code: "+58", label: "🇻🇪 Venezuela (+58)" },
  { value: "VN", code: "+84", label: "🇻🇳 Vietnam (+84)" },
  { value: "YE", code: "+967", label: "🇾🇪 Yemen (+967)" },
  { value: "ZM", code: "+260", label: "🇿🇲 Zambia (+260)" },
  { value: "ZW", code: "+263", label: "🇿🇼 Zimbabwe (+263)" },
] as const;

type Step = "details" | "questions" | "auth" | "checking" | "approved";

function PausedPanel() {
  return (
    <div className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-6 sm:p-7 overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute -top-24 -left-24 h-64 w-64 rounded-full blur-3xl opacity-30"
          style={{ background: "radial-gradient(circle, rgba(34,211,238,0.8), transparent 60%)" }}
          animate={{ x: [0, 18, -6, 0], y: [0, 10, -8, 0], opacity: [0.24, 0.34, 0.26, 0.24] }}
          transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-28 -right-24 h-72 w-72 rounded-full blur-3xl opacity-25"
          style={{ background: "radial-gradient(circle, rgba(236,72,153,0.75), transparent 60%)" }}
          animate={{ x: [0, -14, 8, 0], y: [0, -10, 12, 0], opacity: [0.22, 0.32, 0.24, 0.22] }}
          transition={{ duration: 5.8, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:36px_36px]" />
      </div>

      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/5 ring-1 ring-white/10 px-3 py-1 text-xs text-white/70">
          <PauseCircle className="h-4 w-4 text-white/75" />
          Applications paused
        </div>

        <div className="mt-4 text-2xl sm:text-3xl font-semibold tracking-tight text-white">
          Not accepting applications right now
        </div>
        <p className="mt-3 text-sm text-white/70 leading-relaxed max-w-xl">
          We’re temporarily pausing applications to process the current batch. Come back after some
          time.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-white/90 bg-white/5 ring-1 ring-white/10 hover:bg-white/8 transition-colors"
          >
            Back to home
          </Link>

          <Link
            href="/marketplace"
            className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-white/90 bg-white/5 ring-1 ring-white/10 hover:bg-white/8 transition-colors"
          >
            Explore marketplace
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ApplyPage() {
  const reduce = useReducedMotion();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { userId, authReady } = useAuth();

  const [step, setStep] = useState<Step>("details");

  // applications paused flag (from admin toggle)
  const [appsPaused, setAppsPaused] = useState(false);
  const [appsPausedLoading, setAppsPausedLoading] = useState(true);

  // personal details
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("US"); // stores ISO, not "+code"
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [occupation, setOccupation] = useState("");

  // questions
  const [consent, setConsent] = useState(false);
  const [q1, setQ1] = useState<string>("");
  const [q2, setQ2] = useState<string>("");
  const [q3, setQ3] = useState<string>("");
  const [q4, setQ4] = useState<string>("");
  const [q5, setQ5] = useState("");
  const [q6, setQ6] = useState<string>("");

  // captcha (client token) + verification state
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaVerifying, setCaptchaVerifying] = useState(false);
  const [captchaVerified, setCaptchaVerified] = useState(false);

  // server submit / ui
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [applicationId, setApplicationId] = useState<string>("");

  const didAutoContinueRef = useRef(false);

  const selectedCountry = COUNTRY_CODES.find((c) => c.value === countryCode);
  const dialCode = selectedCountry?.code || "+1";
  const phoneFull = `${dialCode}${phone.replace(/\s/g, "")}`;

  const step0Valid = fullName.trim().length >= 2 && /^\S+@\S+\.\S+$/.test(email.trim());
  // Phone is optional; no minimum length

  const q5Trim = q5.trim();
  const q5Valid = q5Trim.length >= 10 && q5Trim.length <= 140;

  const questionsValid = q1 && q2 && q3 && captchaVerified;

  async function fetchAppsPaused() {
    setAppsPausedLoading(true);
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "applications_paused")
        .maybeSingle();

      if (error) throw error;
      const v = Boolean((data as any)?.value);
      setAppsPaused(v);
    } catch {
      // fail-open: if settings table missing or query fails, do NOT block applications
      setAppsPaused(false);
    } finally {
      setAppsPausedLoading(false);
    }
  }

  // load + realtime subscribe so it flips instantly
  useEffect(() => {
    fetchAppsPaused();

    const ch = supabase
      .channel("realtime:app_settings:applications_paused")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_settings",
          filter: "key=eq.applications_paused",
        },
        (payload: any) => {
          const next = Boolean(payload?.new?.value);
          setAppsPaused(next);
        },
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(ch);
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persistDraft(patch?: Partial<any>) {
    try {
      const raw = sessionStorage.getItem("edgaze:applyDraft");
      const prev = raw ? JSON.parse(raw) : {};
      const next = {
        ...prev,
        ...patch,
        fullName,
        email,
        countryCode,
        phone,
        company,
        occupation,
        consent,
        q1,
        q2,
        q3,
        q4,
        q5,
        q6,
        captchaToken,
        captchaVerified,
      };
      sessionStorage.setItem("edgaze:applyDraft", JSON.stringify(next));
    } catch {}
  }

  function restoreDraft() {
    try {
      const raw = sessionStorage.getItem("edgaze:applyDraft");
      if (!raw) return;
      const d = JSON.parse(raw);
      setFullName(d.fullName || "");
      setEmail(d.email || "");
      setCountryCode(d.countryCode || "US");
      setPhone(d.phone || "");
      setCompany(d.company || "");
      setOccupation(d.occupation || "");
      setConsent(Boolean(d.consent));
      setQ1(d.q1 || "");
      setQ2(d.q2 || "");
      setQ3(d.q3 || "");
      setQ4(d.q4 || "");
      setQ5(d.q5 || "");
      setQ6(d.q6 || "");
      setCaptchaToken(d.captchaToken || "");
      setCaptchaVerified(Boolean(d.captchaVerified));
    } catch {}
  }

  // Captcha: verify immediately on page 2 and set a server proof cookie
  const onCaptchaToken = useCallback(async (t: string) => {
    setCaptchaToken(t);
    setCaptchaVerified(false);
    persistDraft({ captchaToken: t, captchaVerified: false });

    if (!t) return;

    setCaptchaVerifying(true);
    try {
      const r = await fetch("/api/turnstile/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: t }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Captcha failed");
      setCaptchaVerified(true);
      persistDraft({ captchaVerified: true });
    } catch {
      setCaptchaVerified(false);
      persistDraft({ captchaVerified: false });
    } finally {
      setCaptchaVerifying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore draft + OAuth resume (prevents Google callback dumping you at step 1)
  useEffect(() => {
    restoreDraft();

    try {
      const resume = sessionStorage.getItem("edgaze:apply:resume") === "1";
      const resumeStep = sessionStorage.getItem("edgaze:apply:resumeStep");
      if (resume && resumeStep === "auth") {
        setStep("auth");
      }
    } catch {}
  }, []);

  async function goToQuestions() {
    setError("");
    if (!step0Valid) {
      setError("Fill your name and a valid email.");
      return;
    }
    setStep("questions");
  }

  async function goToAuth() {
    setError("");
    if (!questionsValid) {
      setError("Answer everything and verify captcha.");
      return;
    }
    persistDraft();
    setStep("auth");
  }

  async function afterAuthed() {
    // always persist before we leave this state
    persistDraft();

    setStep("checking");
    setError("");

    // 10 seconds always
    await new Promise((r) => setTimeout(r, 10_000));

    setSubmitting(true);
    try {
      const { data } = await supabase.auth.getSession();
      const access_token = data?.session?.access_token;
      if (!access_token) throw new Error("No active session. Sign in again.");

      // Captcha is NOT sent here. It was already verified on page 2 and stored as an httpOnly cookie proof.
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          access_token,

          full_name: fullName,
          email,
          phone_country_code: dialCode,
          phone_number: phone.replace(/\s/g, ""),

          company: company || null,
          occupation: occupation || null,

          feedback_consent: consent,

          q1,
          q2,
          q3,
          q4: q4 || undefined,
          q5: q5Trim || undefined,
          q6: q6 || undefined,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to submit.");

      setApplicationId(String(json.id || ""));
      setStep("approved");

      try {
        sessionStorage.removeItem("edgaze:applyDraft");
        sessionStorage.removeItem("edgaze:apply:resume");
        sessionStorage.removeItem("edgaze:apply:resumeStep");
      } catch {}
    } catch (e: any) {
      setError(e?.message || "Failed to submit.");
      setStep("questions");
    } finally {
      setSubmitting(false);
    }
  }

  // Auto-continue after OAuth return (or if user already signed in on auth step)
  useEffect(() => {
    if (!authReady) return;
    if (!userId) return;
    if (didAutoContinueRef.current) return;

    let shouldContinue = step === "auth";

    try {
      const resume = sessionStorage.getItem("edgaze:apply:resume") === "1";
      const resumeStep = sessionStorage.getItem("edgaze:apply:resumeStep");
      if (resume && resumeStep === "auth") {
        shouldContinue = true;
        if (step !== "auth") setStep("auth");
      }
    } catch {}

    if (!shouldContinue) return;

    didAutoContinueRef.current = true;

    try {
      sessionStorage.removeItem("edgaze:apply:resume");
      sessionStorage.removeItem("edgaze:apply:resumeStep");
    } catch {}

    afterAuthed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, userId, step]);

  const showPaused = !appsPausedLoading && appsPaused;

  return (
    <div className="relative min-h-screen text-white">
      <Gradients />

      {/* Error popup — show above content, dismissible */}
      <AnimatePresence>
        {error ? (
          <motion.div
            key="error-popup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setError("")}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="rounded-2xl bg-[#0b0c11] ring-1 ring-red-400/30 shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-red-500/15 p-2 shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white">Something went wrong</h3>
                  <p className="mt-2 text-sm text-white/80">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setError("")}
                  className="shrink-0 rounded-lg p-1.5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setError("")}
                className="mt-5 w-full rounded-xl py-2.5 text-sm font-semibold bg-white/10 text-white hover:bg-white/15 transition-colors"
              >
                Dismiss
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="sticky top-0 z-20">
        <div className="bg-[#07080b]/70 backdrop-blur-md ring-1 ring-white/10">
          <div className="mx-auto w-full max-w-4xl px-5 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <img src="/brand/edgaze-mark.png" alt="Edgaze" className="h-9 w-9" />
              <div className="text-sm font-semibold tracking-wide">Edgaze</div>
            </Link>

            <div className="inline-flex items-center gap-2 rounded-full bg-white/5 ring-1 ring-white/10 px-3 py-1 text-xs text-white/70">
              <Sparkles className="h-3.5 w-3.5 text-white/75" />
              Beta
            </div>
          </div>
          <AccentLine />
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:py-12">
        <Frame>
          <div className="p-6 sm:p-8">
            <div>
              <div className="text-xs font-semibold tracking-widest text-white/55">EDGAZE BETA</div>
              <h1 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                Apply
              </h1>
              <p className="mt-2 text-sm font-medium text-emerald-200/95">
                Get access within 30 seconds of applying.
              </p>
              <p className="mt-3 text-sm text-white/70 leading-relaxed">
                By continuing, you agree to our{" "}
                <Link
                  href="/docs/terms-of-service"
                  className="text-white/80 hover:text-white underline underline-offset-4"
                >
                  Terms
                </Link>{" "}
                and{" "}
                <Link
                  href="/docs/privacy-policy"
                  className="text-white/80 hover:text-white underline underline-offset-4"
                >
                  Privacy Policy
                </Link>
                . By joining beta, you agree to give feedback to improve Edgaze.
              </p>
            </div>

            <AnimatePresence mode="wait">
              {showPaused ? (
                <motion.div
                  key="paused"
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={reduce ? undefined : { opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -10 }}
                  transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                  className="mt-8"
                >
                  <PausedPanel />
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={reduce ? undefined : { opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -10 }}
                  transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <AnimatePresence mode="wait">
                    {step === "details" ? (
                      <motion.div
                        key="details"
                        initial={reduce ? false : { opacity: 0, y: 10 }}
                        animate={reduce ? undefined : { opacity: 1, y: 0 }}
                        exit={reduce ? undefined : { opacity: 0, y: -10 }}
                        transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                        className="mt-8 space-y-6"
                      >
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <FieldLabel>FULL NAME</FieldLabel>
                            <Input
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              autoComplete="name"
                            />
                          </div>

                          <div className="space-y-2">
                            <FieldLabel>EMAIL</FieldLabel>
                            <Input
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              autoComplete="email"
                              inputMode="email"
                            />
                          </div>

                          <div className="space-y-2 sm:col-span-2">
                            <FieldLabel>PHONE (OPTIONAL)</FieldLabel>
                            <div className="grid grid-cols-[160px_1fr] gap-2">
                              <select
                                value={countryCode}
                                onChange={(e) => setCountryCode(e.target.value)}
                                className={cn(
                                  "rounded-2xl bg-white/5 ring-1 ring-white/10 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-white/20",
                                  // closed select look
                                  "text-white",
                                  // Windows dropdown list (options) readability: prevent white text on white bg
                                  "bg-transparent",
                                  "[&>option]:bg-white [&>option]:text-black",
                                  // try to keep emoji/flags consistent across platforms
                                  "font-sans",
                                )}
                              >
                                {COUNTRY_CODES.map((c) => (
                                  <option key={c.value} value={c.value}>
                                    {c.label}
                                  </option>
                                ))}
                              </select>

                              <Input
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                inputMode="tel"
                                autoComplete="tel"
                                placeholder="Phone number"
                              />
                            </div>
                            <div className="text-xs text-white/45 mt-2">
                              Stored as <span className="text-white/70">{phoneFull}</span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <FieldLabel>COMPANY (OPTIONAL)</FieldLabel>
                            <Input value={company} onChange={(e) => setCompany(e.target.value)} />
                          </div>

                          <div className="space-y-2">
                            <FieldLabel>OCCUPATION (OPTIONAL)</FieldLabel>
                            <Input
                              value={occupation}
                              onChange={(e) => setOccupation(e.target.value)}
                            />
                          </div>
                        </div>

                        <PrimaryButton disabled={!step0Valid} onClick={goToQuestions}>
                          Continue
                        </PrimaryButton>
                      </motion.div>
                    ) : null}

                    {step === "questions" ? (
                      <motion.div
                        key="questions"
                        initial={reduce ? false : { opacity: 0, y: 10 }}
                        animate={reduce ? undefined : { opacity: 1, y: 0 }}
                        exit={reduce ? undefined : { opacity: 0, y: -10 }}
                        transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                        className="mt-8 space-y-8"
                      >
                        <div className="space-y-3">
                          <FieldLabel>HOW OFTEN DO YOU USE AI TOOLS?</FieldLabel>
                          <div className="grid grid-cols-1 gap-2">
                            {[
                              "I’ve tried them a few times",
                              "I use them occasionally (weekly)",
                              "I rely on them daily for work or study",
                              "I use them heavily across multiple workflows every day",
                            ].map((opt) => (
                              <Option key={opt} selected={q1 === opt} onClick={() => setQ1(opt)}>
                                {opt}
                              </Option>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <FieldLabel>WHICH BEST MATCHES WHAT YOU’VE DONE WITH AI?</FieldLabel>
                          <div className="grid grid-cols-1 gap-2">
                            {[
                              "Casual use (chatting, homework help, basic questions)",
                              "Structured prompts for real tasks (writing, coding, research, content)",
                              "Connected prompts into repeatable workflows or systems",
                              "Built, shared, or sold AI setups, prompt packs, or tools",
                            ].map((opt) => (
                              <Option key={opt} selected={q2 === opt} onClick={() => setQ2(opt)}>
                                {opt}
                              </Option>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <FieldLabel>WHY DO YOU WANT EDGAZE?</FieldLabel>
                          <div className="grid grid-cols-1 gap-2">
                            {[
                              "Run higher-quality prompts and workflows made by others",
                              "Turn my own prompts into something reusable and organized",
                              "Build, publish, and iterate on workflows or prompt packs",
                              "Explore what advanced AI users are building",
                              "Eventually monetize my AI setups",
                            ].map((opt) => (
                              <Option key={opt} selected={q3 === opt} onClick={() => setQ3(opt)}>
                                {opt}
                              </Option>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <FieldLabel>
                            WILL YOU REPORT ISSUES / GIVE FEEDBACK DURING BETA? (optional)
                          </FieldLabel>
                          <div className="grid grid-cols-1 gap-2">
                            {[
                              "Yes, I’m happy to give feedback",
                              "Maybe, if I have time",
                              "Probably not",
                            ].map((opt) => (
                              <Option key={opt} selected={q4 === opt} onClick={() => setQ4(opt)}>
                                {opt}
                              </Option>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <FieldLabel>WHAT WILL YOU TRY FIRST?</FieldLabel>
                          <div className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-4">
                            <Textarea
                              value={q5}
                              onChange={(e) => setQ5(e.target.value)}
                              rows={3}
                              maxLength={140}
                              placeholder="One sentence (optional, max 140 chars)"
                            />
                            <div className="mt-2 flex items-center justify-between text-xs text-white/50">
                              <div className="text-white/40">
                                Example: “Turn my research prompt into a reusable workflow”
                              </div>
                              <div
                                className={cn(
                                  q5Trim.length > 140 ? "text-red-300" : "text-white/55",
                                )}
                              >
                                {q5Trim.length}/140
                              </div>
                            </div>
                            {q5Trim.length > 140 ? (
                              <div className="mt-2 text-xs text-white/60">Max 140 characters.</div>
                            ) : null}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <FieldLabel>
                            HAVE YOU SHARED PROMPTS / WORKFLOWS BEFORE? (optional)
                          </FieldLabel>
                          <div className="grid grid-cols-1 gap-2">
                            {[
                              "No, never",
                              "Yes, informally (friends, Discord, WhatsApp, Notion)",
                              "Yes, publicly (Twitter, GitHub, Gumroad, etc.)",
                            ].map((opt) => (
                              <Option key={opt} selected={q6 === opt} onClick={() => setQ6(opt)}>
                                {opt}
                              </Option>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-5">
                          <div className="text-sm font-semibold text-white">One last step</div>
                          <div className="mt-2 text-sm text-white/70">Prove you’re human.</div>
                          <div className="mt-4">
                            <TurnstileWidget onToken={onCaptchaToken} />
                          </div>

                          {captchaVerifying ? (
                            <div className="mt-2 text-xs text-white/55">Verifying captcha…</div>
                          ) : captchaVerified ? (
                            <div className="mt-2 text-xs text-emerald-200">Captcha verified</div>
                          ) : (
                            <div className="mt-2 text-xs text-white/55">
                              Captcha required to continue.
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <SecondaryButton onClick={() => setStep("details")}>Back</SecondaryButton>
                          <PrimaryButton disabled={!questionsValid} onClick={goToAuth}>
                            Continue to sign in
                          </PrimaryButton>
                        </div>
                      </motion.div>
                    ) : null}

                    {step === "auth" ? (
                      <motion.div
                        key="auth"
                        initial={reduce ? false : { opacity: 0, y: 10 }}
                        animate={reduce ? undefined : { opacity: 1, y: 0 }}
                        exit={reduce ? undefined : { opacity: 0, y: -10 }}
                        transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                        className="mt-8"
                      >
                        <ApplyAuthPanel
                          emailPrefill={email}
                          fullNamePrefill={fullName}
                          onAuthed={afterAuthed}
                        />
                      </motion.div>
                    ) : null}

                    {step === "checking" ? (
                      <motion.div
                        key="checking"
                        initial={reduce ? false : { opacity: 0, y: 10 }}
                        animate={reduce ? undefined : { opacity: 1, y: 0 }}
                        exit={reduce ? undefined : { opacity: 0, y: -10 }}
                        transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                        className="mt-10"
                      >
                        <div className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-6 sm:p-7 overflow-hidden">
                          <div className="text-xs font-semibold tracking-widest text-white/55">
                            PROCESSING
                          </div>
                          <div className="mt-2 text-2xl font-semibold text-white">
                            Checking your application
                          </div>

                          <div className="mt-6 relative h-[160px] rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
                            <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:36px_36px]" />
                            <motion.div
                              className="absolute left-6 top-6 right-6 bottom-6 rounded-xl border border-white/12 bg-white/[0.03]"
                              initial={false}
                            />

                            <motion.div
                              className="absolute top-[28px] left-[28px] w-[120px] h-[16px] rounded bg-white/10"
                              animate={{ opacity: [0.35, 0.7, 0.35] }}
                              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                            />
                            <motion.div
                              className="absolute top-[56px] left-[28px] w-[200px] h-[16px] rounded bg-white/10"
                              animate={{ opacity: [0.35, 0.7, 0.35] }}
                              transition={{
                                duration: 1.6,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: 0.1,
                              }}
                            />
                            <motion.div
                              className="absolute top-[84px] left-[28px] w-[260px] h-[16px] rounded bg-white/10"
                              animate={{ opacity: [0.35, 0.7, 0.35] }}
                              transition={{
                                duration: 1.7,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: 0.2,
                              }}
                            />

                            <motion.div
                              className="absolute"
                              animate={{
                                x: ["10%", "65%", "20%", "75%", "10%"],
                                y: ["20%", "35%", "60%", "45%", "20%"],
                              }}
                              transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
                              style={{ left: 0, top: 0 }}
                            >
                              <div className="rounded-full bg-white/10 ring-1 ring-white/15 p-3 shadow-[0_0_40px_rgba(34,211,238,0.10)]">
                                <Search className="h-5 w-5 text-white/80" />
                              </div>
                            </motion.div>
                          </div>

                          <div className="mt-5 space-y-1 text-sm text-white/70">
                            <motion.div
                              animate={{ opacity: [0.4, 1, 0.4] }}
                              transition={{ duration: 1.6, repeat: Infinity }}
                            >
                              Viewing your application…
                            </motion.div>
                            <motion.div
                              animate={{ opacity: [0.4, 1, 0.4] }}
                              transition={{ duration: 1.8, repeat: Infinity, delay: 0.1 }}
                            >
                              Auto checking…
                            </motion.div>
                            <motion.div
                              animate={{ opacity: [0.4, 1, 0.4] }}
                              transition={{ duration: 2.0, repeat: Infinity, delay: 0.2 }}
                            >
                              Almost there…
                            </motion.div>
                            {submitting ? (
                              <div className="text-xs text-white/55 mt-2">Finalizing…</div>
                            ) : null}
                          </div>
                        </div>
                      </motion.div>
                    ) : null}

                    {step === "approved" ? (
                      <motion.div
                        key="approved"
                        initial={reduce ? false : { opacity: 0, y: 10 }}
                        animate={reduce ? undefined : { opacity: 1, y: 0 }}
                        exit={reduce ? undefined : { opacity: 0, y: -10 }}
                        transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                        className="mt-10"
                      >
                        <div className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-6 sm:p-7">
                          <div className="flex items-start gap-4">
                            <CheckCircle2 className="h-6 w-6 text-white/85 mt-0.5" />
                            <div>
                              <div className="text-lg font-semibold text-white">Approved</div>
                              <div className="mt-2 text-sm text-white/70">
                                Welcome. Your application is in.
                              </div>
                              {applicationId ? (
                                <div className="mt-4 text-xs text-white/50">
                                  Reference: <span className="text-white/70">{applicationId}</span>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <PrimaryButton onClick={() => (window.location.href = "/marketplace")}>
                              Enter marketplace
                            </PrimaryButton>
                            <SecondaryButton onClick={() => (window.location.href = "/")}>
                              Back to home
                            </SecondaryButton>
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Frame>

        <div className="mt-10 text-center text-xs text-white/45">
          © 2026 Edge Platforms, Inc. All rights reserved.
        </div>
      </div>
    </div>
  );
}
