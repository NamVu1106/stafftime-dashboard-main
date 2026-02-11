import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useI18n } from '@/contexts/I18nContext';

// Flag icons as SVG components
const VietnamFlag = () => (
  <svg width="20" height="15" viewBox="0 0 20 15" className="rounded-sm" xmlns="http://www.w3.org/2000/svg">
    <rect width="20" height="15" fill="#DA020E"/>
    <polygon points="10,4.5 11.5,8.5 8.5,8.5" fill="#FFFF00"/>
  </svg>
);

const KoreaFlag = () => (
  <svg width="20" height="15" viewBox="0 0 20 15" className="rounded-sm" xmlns="http://www.w3.org/2000/svg">
    <rect width="20" height="15" fill="#FFFFFF"/>
    <circle cx="10" cy="7.5" r="3" fill="#C60C30"/>
    <circle cx="10" cy="7.5" r="2" fill="#003478"/>
    <path d="M 10 4.5 L 10.5 6.5 L 12.5 6.5 L 10.8 7.5 L 11.3 9.5 L 10 8.5 L 8.7 9.5 L 9.2 7.5 L 7.5 6.5 L 9.5 6.5 Z" fill="#FFFFFF"/>
  </svg>
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
















