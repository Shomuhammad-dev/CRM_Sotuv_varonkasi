import { Star, Phone, Users, Check, XCircle, Building2, GraduationCap } from "lucide-react";

export const STAGES = [
  { id: "new",          label: "Yangi lidlar",              color: "blue",   icon: Star,          count_color: "bg-blue-100 text-blue-700"    },
  { id: "contacted",    label: "Brak nomer",                color: "amber",  icon: Phone,         count_color: "bg-amber-100 text-amber-700"  },
  { id: "invited",      label: "Sinovga taklif qilindi",    color: "violet", icon: Users,         count_color: "bg-violet-100 text-violet-700"},
  { id: "our_center",   label: "Markazimizda o'qidi",       color: "teal",   icon: GraduationCap, count_color: "bg-teal-100 text-teal-700"    },
  { id: "other_center", label: "Boshqa markazda o'qidi",    color: "orange", icon: Building2,     count_color: "bg-orange-100 text-orange-700"},
  { id: "won",          label: "A'zo bo'ldi / Yutildi",     color: "emerald",icon: Check,         count_color: "bg-emerald-100 text-emerald-700"},
  { id: "lost",         label: "Rad etdi / Yo'qotildi",     color: "rose",   icon: XCircle,       count_color: "bg-rose-100 text-rose-700"    },
];

export const STAGE_STYLES = {
  new:          { header: "border-blue-400 bg-blue-50",      badge: "bg-blue-500",    ring: "ring-blue-300",    text: "text-blue-700"    },
  contacted:    { header: "border-amber-400 bg-amber-50",    badge: "bg-amber-500",   ring: "ring-amber-300",   text: "text-amber-700"   },
  invited:      { header: "border-violet-400 bg-violet-50",  badge: "bg-violet-500",  ring: "ring-violet-300",  text: "text-violet-700"  },
  our_center:   { header: "border-teal-400 bg-teal-50",      badge: "bg-teal-500",    ring: "ring-teal-300",    text: "text-teal-700"    },
  other_center: { header: "border-orange-400 bg-orange-50",  badge: "bg-orange-500",  ring: "ring-orange-300",  text: "text-orange-700"  },
  won:          { header: "border-emerald-400 bg-emerald-50", badge: "bg-emerald-500", ring: "ring-emerald-300", text: "text-emerald-700" },
  lost:         { header: "border-rose-400 bg-rose-50",      badge: "bg-rose-500",    ring: "ring-rose-300",    text: "text-rose-700"    },
};

export const DISTRICTS = ["Yuqori Chirchiq tumani"];

export const SUBJECTS = [
  "Matematika", "Fizika", "Kimyo", "Biologiya", "Ingliz tili",
  "Rus tili", "Tarix", "Geografiya", "Informatika", "Adabiyot", "Chizmachilik",
];

export const SECTORS = ["O'zbek", "Rus"];

export const CLASSES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];

export const EMPTY_FORM = {
  district: "", fullName: "", school: "", grade: "",
  sector: "O'zbek", futureProfession: "", subjects: [],
  prevCenter: "", notes: "", phonePersonal: "", phoneFather: "", phoneMother: "",
  stage: "new", assignedOperatorId: null,
};
