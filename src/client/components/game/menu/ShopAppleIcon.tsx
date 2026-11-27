import { REALM_APPLE, type ShopApple } from '../../../../shared/game/items';
import apple from '../../../assets/ui/shop-apple.svg';
import realmApple from '../../../assets/ui/shop-realm-apple.svg';

export function ShopAppleIcon({ item, className }: { item: ShopApple; className?: string }) {
  return <img src={item === REALM_APPLE ? realmApple : apple} className={className} alt="" aria-hidden="true" draggable={false} />;
}
