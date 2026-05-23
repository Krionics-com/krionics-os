import { Card } from "@/components/ui/card";
import Link from "next/link";
import { ArrowRight, TrendingUp, TrendingDown } from "lucide-react";

interface KpiCardProps {
  title: string;
  subtitle: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'primary' | 'green' | 'red' | 'yellow' | 'blue' | 'orange';
  link?: { text: string; href: string };
  trend?: { value: number; isPositive: boolean }; // e.g., +15% or -5%
}

const colorMap = {
  primary: "text-primary bg-primary/10 border-primary/20",
  green: "text-green-600 bg-green-50 border-green-200",
  red: "text-red-600 bg-red-50 border-red-200",
  yellow: "text-yellow-600 bg-yellow-50 border-yellow-200",
  blue: "text-blue-600 bg-blue-50 border-blue-200",
  orange: "text-orange-600 bg-orange-50 border-orange-200",
};

export function KpiCard({ title, subtitle, value, icon, color = 'primary', link, trend }: KpiCardProps) {
  return (
    <Card className="p-5 flex flex-col justify-between hover:shadow-md transition-shadow h-full border border-border bg-card">
      <div>
        <div className="flex justify-between items-start mb-4">
          <div className={`p-2.5 rounded-lg border ${colorMap[color]}`}>
            {icon}
          </div>
          {trend && (
            <div className={`flex items-center text-xs font-bold px-2 py-1 rounded-full ${trend.isPositive ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>
              {trend.isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {trend.isPositive ? '+' : '-'}{Math.abs(trend.value)}%
            </div>
          )}
        </div>
        <div className="text-3xl font-extrabold font-heading tracking-tight text-foreground">{value}</div>
        <div className="text-sm font-semibold text-foreground mt-1">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
      </div>
      {link && (
        <div className="mt-5 pt-4 border-t border-border">
          <Link href={link.href} className="text-xs text-primary font-bold flex items-center hover:underline w-fit">
            {link.text} <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Link>
        </div>
      )}
    </Card>
  );
}
