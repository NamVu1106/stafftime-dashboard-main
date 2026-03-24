import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useI18n } from '@/hooks/useI18n';

const flagClass = 'w-7 h-5 object-contain rounded-sm shrink-0 select-none';
const flagStyle: React.CSSProperties = { imageRendering: 'crisp-edges' };

const VietnamFlag = () => (
  <img src="/flag-vietnam.webp" alt="VN" className={flagClass} style={flagStyle} draggable={false} />
);

const KoreaFlag = () => (
  <img src="/flag-korea.webp" alt="KR" className={flagClass} style={flagStyle} draggable={false} />
);

export const LanguageSwitcher = () => {
  const { language, setLanguage, t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title={t('common.language')}>
          <Languages className="w-5 h-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => setLanguage('vi')}
          className={`flex items-center gap-2 cursor-pointer ${
            language === 'vi' ? 'bg-muted' : ''
          }`}
        >
          <VietnamFlag />
          <span>{t('common.vietnamese')}</span>
          {language === 'vi' && <span className="ml-auto text-primary">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLanguage('ko')}
          className={`flex items-center gap-2 cursor-pointer ${
            language === 'ko' ? 'bg-muted' : ''
          }`}
        >
          <KoreaFlag />
          <span>{t('common.korean')}</span>
          {language === 'ko' && <span className="ml-auto text-primary">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
















