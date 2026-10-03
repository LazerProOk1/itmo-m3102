import { CircleUser, Keyboard } from 'lucide-react';
import { useShortcutsDialog } from '../../features/help/ShortcutsDialog';
import { useNavigate } from 'react-router';
import { SECTIONS } from '../../app/navigation';
import { useSettingsStore } from '../../features/settings/settingsStore';
import { THEME_OPTIONS } from '../../features/settings/themeOptions';
import { DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator } from '../ui/DropdownMenu';
import { IconButton } from '../ui/IconButton';

/** Меню в правом верхнем углу: пользователь, настройки, страница компонентов, тема. */
export function UserMenu() {
  const navigate = useNavigate();
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const openShortcuts = useShortcutsDialog((state) => state.setOpen);

  return (
    <DropdownMenu align="end" trigger={(props) => <IconButton icon={CircleUser} label="Меню" {...props} />}>
      <DropdownItem icon={SECTIONS.settings.icon} onSelect={() => navigate(SECTIONS.settings.path)}>
        Настройки
      </DropdownItem>
      <DropdownItem icon={SECTIONS.design.icon} onSelect={() => navigate(SECTIONS.design.path)}>
        Дизайн-система
      </DropdownItem>
      <DropdownItem icon={Keyboard} onSelect={() => openShortcuts(true)}>
        Сочетания клавиш
      </DropdownItem>

      <DropdownSeparator />
      <DropdownLabel>Тема</DropdownLabel>
      {THEME_OPTIONS.map((option) => (
        <DropdownItem key={option.value} icon={option.icon} checked={theme === option.value} onSelect={() => setTheme(option.value)}>
          {option.label}
        </DropdownItem>
      ))}
    </DropdownMenu>
  );
}
