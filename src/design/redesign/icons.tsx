import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
import { redesignLight } from './theme';

export type RedesignIconName =
  | 'alert'
  | 'arrow-left'
  | 'arrow-right'
  | 'bank'
  | 'bell'
  | 'calendar'
  | 'check'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-up'
  | 'clock'
  | 'cloud-off'
  | 'edit'
  | 'export'
  | 'eye'
  | 'eye-off'
  | 'file'
  | 'filter'
  | 'flow'
  | 'home'
  | 'import'
  | 'info'
  | 'list'
  | 'lock'
  | 'logout'
  | 'menu'
  | 'more'
  | 'pie'
  | 'plus'
  | 'pulse'
  | 'refresh'
  | 'repeat'
  | 'search'
  | 'select'
  | 'sliders'
  | 'swap'
  | 'target'
  | 'trash'
  | 'trending-up'
  | 'user'
  | 'users'
  | 'x'
  | 'zap';

type Props = SvgProps & { name: RedesignIconName; size?: number; color?: string };

/** 41 Figma icons from MyLedja Components (file 5M9YOpaMJAiJ9VJv567rs9). Stroke uses current color. */
export function RedesignIcon({ name, size = 24, color, ...rest }: Props) {
  const stroke = color ?? redesignLight.text;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
      {renderIcon(name, stroke)}
    </Svg>
  );
}

function renderIcon(name: RedesignIconName, color: string) {
  switch (name) {
    case 'alert':
      return (
        <>
          <Path d="M12 3L22 21H2L12 3Z" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M12 10V15M12 18H12.01" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'arrow-left':
      return (
        <>
          <Path d="M19 12H5M12 5L5 12L12 19" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'arrow-right':
      return (
        <>
          <Path d="M5 12H19M12 19L19 12L12 5" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'bank':
      return (
        <>
          <Path d="M3 9L12 4L21 9" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M5 9V18M9.5 9V18M14.5 9V18M19 9V18M3 21H21" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'bell':
      return (
        <>
          <Path d="M6 8C6 6.4087 6.63214 4.88258 7.75736 3.75736C8.88258 2.63214 10.4087 2 12 2C13.5913 2 15.1174 2.63214 16.2426 3.75736C17.3679 4.88258 18 6.4087 18 8C18 15 21 17 21 17H3C3 17 6 15 6 8Z" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M10.3 21C10.4674 21.3044 10.7134 21.5583 11.0125 21.7352C11.3115 21.912 11.6526 22.0053 12 22.0053C12.3474 22.0053 12.6885 21.912 12.9875 21.7352C13.2865 21.5583 13.5326 21.3044 13.7 21" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'calendar':
      return (
        <>
          <Path d="M5 5H19C20.1046 5 21 5.89543 21 7V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V7C3 5.89543 3.89543 5 5 5Z" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M3 10H21M8 3V7M16 3V7" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'check':
      return (
        <>
          <Path d="M5 12.5L9.5 17L19 7.5" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'chevron-down':
      return (
        <>
          <Path d="M6 9L12 15L18 9" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'chevron-left':
      return (
        <>
          <Path d="M15 6L9 12L15 18" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'chevron-right':
      return (
        <>
          <Path d="M9 6L15 12L9 18" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'chevron-up':
      return (
        <>
          <Path d="M18 15L12 9L6 15" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'clock':
      return (
        <>
          <Path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M12 7V12L15 14" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'cloud-off':
      return (
        <>
          <Path d="M3 3L21 21" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M17.5 17H6.99997C5.76002 17.0012 4.56384 16.5417 3.64364 15.7106C2.72344 14.8795 2.14487 13.7362 2.02026 12.5025C1.89565 11.2688 2.23387 10.0329 2.96928 9.03453C3.70469 8.0362 4.78482 7.34675 5.99997 7.1M9.49997 5.4C10.3509 4.99907 11.2842 4.80382 12.2245 4.83003C13.1648 4.85623 14.0857 5.10316 14.913 5.55086C15.7403 5.99857 16.4507 6.63452 16.987 7.40737C17.5232 8.18023 17.8702 9.06833 18 10C18.8705 10.3077 19.6253 10.8758 20.162 11.6271C20.6986 12.3785 20.9912 13.2767 21 14.2" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'edit':
      return (
        <>
          <Path d="M12 20H21" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M16.5 3.50001C16.8978 3.10219 17.4374 2.87869 18 2.87869C18.5626 2.87869 19.1022 3.10219 19.5 3.50001C19.8978 3.89784 20.1213 4.4374 20.1213 5.00001C20.1213 5.56262 19.8978 6.10219 19.5 6.50001L7 19L3 20L4 16L16.5 3.50001Z" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'export':
      return (
        <>
          <Path d="M12 16V4M8 8L12 4L16 8" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M4 17V19C4 20.1046 4.89543 21 6 21H18C19.1046 21 20 20.1046 20 19V17" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'eye':
      return (
        <>
          <Path d="M2 12C2 12 6 5 12 5C18 5 22 12 22 12C22 12 18 19 12 19C6 19 2 12 2 12Z" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12Z" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'eye-off':
      return (
        <>
          <Path d="M9.9 5.2C10.5906 5.05719 11.2948 4.99012 12 5C18 5 22 12 22 12C21.1415 13.4873 20.0626 14.8359 18.8 16M6.6 6.6C4.69549 8.04752 3.12633 9.88958 2 12C2 12 6 19 12 19C13.9186 19.0125 15.7979 18.4557 17.4 17.4" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M3 3L21 21" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'file':
      return (
        <>
          <Path d="M14 3H6C5.46957 3 4.96086 3.21071 4.58579 3.58579C4.21071 3.96086 4 4.46957 4 5V19C4 19.5304 4.21071 20.0391 4.58579 20.4142C4.96086 20.7893 5.46957 21 6 21H18C18.5304 21 19.0391 20.7893 19.4142 20.4142C19.7893 20.0391 20 19.5304 20 19V9L14 3Z" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M14 3V9H20M8 13H16M8 17H14" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'filter':
      return (
        <>
          <Path d="M3 5H21L14 13V19L10 21V13L3 5Z" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'flow':
      return (
        <>
          <Path d="M3 6H9C13 6 13 12 17 12M17 12H21M17 12C13 12 13 18 9 18H3" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M18 9L21 12L18 15" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'home':
      return (
        <>
          <Path d="M3 10.5L12 3L21 10.5V20C21 20.2652 20.8946 20.5196 20.7071 20.7071C20.5196 20.8946 20.2652 21 20 21H15V15H9V21H4C3.73478 21 3.48043 20.8946 3.29289 20.7071C3.10536 20.5196 3 20.2652 3 20V10.5Z" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'import':
      return (
        <>
          <Path d="M12 3V15M8 11L12 15L16 11" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M4 17V19C4 20.1046 4.89543 21 6 21H18C19.1046 21 20 20.1046 20 19V17" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'info':
      return (
        <>
          <Path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M12 16V12M12 8H12.01" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'list':
      return (
        <>
          <Path d="M8 6H21M8 12H21M8 18H21M3 6H3.01M3 12H3.01M3 18H3.01" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'lock':
      return (
        <>
          <Path d="M6 11H18C19.1046 11 20 11.8954 20 13V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V13C4 11.8954 4.89543 11 6 11Z" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M8 11V7C8 5.93913 8.42143 4.92172 9.17157 4.17157C9.92172 3.42143 10.9391 3 12 3C13.0609 3 14.0783 3.42143 14.8284 4.17157C15.5786 4.92172 16 5.93913 16 7V11" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'logout':
      return (
        <>
          <Path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9M16 7L21 12L16 17M21 12H9" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'menu':
      return (
        <>
          <Path d="M4 6H20M4 12H20M4 18H20" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'more':
      return (
        <>
          <Path d="M6 12C6 12.5523 5.55228 13 5 13C4.44772 13 4 12.5523 4 12C4 11.4477 4.44772 11 5 11C5.55228 11 6 11.4477 6 12Z" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M13 12C13 12.5523 12.5523 13 12 13C11.4477 13 11 12.5523 11 12C11 11.4477 11.4477 11 12 11C12.5523 11 13 11.4477 13 12Z" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M20 12C20 12.5523 19.5523 13 19 13C18.4477 13 18 12.5523 18 12C18 11.4477 18.4477 11 19 11C19.5523 11 20 11.4477 20 12Z" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'pie':
      return (
        <>
          <Path d="M21.21 15.89C20.5738 17.3945 19.5788 18.7202 18.3119 19.7513C17.045 20.7824 15.5448 21.4874 13.9424 21.8048C12.3401 22.1221 10.6844 22.0421 9.12015 21.5718C7.55588 21.1014 6.13063 20.2551 4.96903 19.1067C3.80742 17.9582 2.94482 16.5428 2.45664 14.9839C1.96846 13.4251 1.86957 11.7705 2.1686 10.1646C2.46764 8.55878 3.1555 7.05063 4.17205 5.77203C5.1886 4.49343 6.50289 3.48332 8.00001 2.83" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M22 12C22 10.6868 21.7413 9.38642 21.2388 8.17317C20.7362 6.95991 19.9997 5.85752 19.0711 4.92893C18.1425 4.00035 17.0401 3.26375 15.8268 2.7612C14.6136 2.25866 13.3132 2 12 2V12H22Z" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'plus':
      return (
        <>
          <Path d="M12 5V12M12 12V19M12 12H5M12 12H19" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'pulse':
      return (
        <>
          <Path d="M3 12H7L9 6L13 18L15 12H21" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'refresh':
      return (
        <>
          <Path d="M21 12C20.9984 10.2633 20.4944 8.56419 19.5487 7.10755C18.6031 5.65091 17.2562 4.49898 15.6705 3.7907C14.0848 3.08243 12.3281 2.84806 10.6121 3.11587C8.89623 3.38368 7.29445 4.14222 6 5.30001L3 8.00001" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M3 3V8H8" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M3 12C3.00158 13.7367 3.5056 15.4358 4.45125 16.8925C5.39691 18.3491 6.74382 19.501 8.32951 20.2093C9.9152 20.9176 11.6719 21.152 13.3879 20.8841C15.1038 20.6163 16.7056 19.8578 18 18.7L21 16" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M16 16H21V21" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'repeat':
      return (
        <>
          <Path d="M17 2L21 6L17 10" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M3 11V10C3 8.93913 3.42143 7.92172 4.17157 7.17157C4.92172 6.42143 5.93913 6 7 6H21" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M7 22L3 18L7 14" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M21 13V14C21 15.0609 20.5786 16.0783 19.8284 16.8284C19.0783 17.5786 18.0609 18 17 18H3" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'search':
      return (
        <>
          <Path d="M18 11C18 14.866 14.866 18 11 18C7.13401 18 4 14.866 4 11C4 7.13401 7.13401 4 11 4C14.866 4 18 7.13401 18 11Z" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M21 21L16.7 16.7" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'select':
      return (
        <>
          <Path d="M6 4H18C19.1046 4 20 4.89543 20 6V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V6C4 4.89543 4.89543 4 6 4Z" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M8 12L11 15L16 9" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'sliders':
      return (
        <>
          <Path d="M3 6H11M15 6H21M3 12H7M11 12H21M3 18H15M19 18H21" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M15 6C15 7.10457 14.1046 8 13 8C11.8954 8 11 7.10457 11 6C11 4.89543 11.8954 4 13 4C14.1046 4 15 4.89543 15 6Z" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M11 12C11 13.1046 10.1046 14 9 14C7.89543 14 7 13.1046 7 12C7 10.8954 7.89543 10 9 10C10.1046 10 11 10.8954 11 12Z" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M19 18C19 19.1046 18.1046 20 17 20C15.8954 20 15 19.1046 15 18C15 16.8954 15.8954 16 17 16C18.1046 16 19 16.8954 19 18Z" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'swap':
      return (
        <>
          <Path d="M7 12L3 8L7 4M3 8H17M17 12L21 16L17 20M21 16H7" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'target':
      return (
        <>
          <Path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M17 12C17 14.7614 14.7614 17 12 17C9.23858 17 7 14.7614 7 12C7 9.23858 9.23858 7 12 7C14.7614 7 17 9.23858 17 12Z" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M13 12C13 12.5523 12.5523 13 12 13C11.4477 13 11 12.5523 11 12C11 11.4477 11.4477 11 12 11C12.5523 11 13 11.4477 13 12Z" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'trash':
      return (
        <>
          <Path d="M3 6H6M6 6H8M6 6L7 20H17L18 6M8 6H16M8 6V4H16V6M16 6H18M18 6H21" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'trending-up':
      return (
        <>
          <Path d="M3 17L9 11L13 15L21 7" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M15 7H21V13" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'user':
      return (
        <>
          <Path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'users':
      return (
        <>
          <Path d="M16 21V19C16 17.9391 15.5786 16.9217 14.8284 16.1716C14.0783 15.4214 13.0609 15 12 15H6C4.93913 15 3.92172 15.4214 3.17157 16.1716C2.42143 16.9217 2 17.9391 2 19V21" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M13 7C13 9.20914 11.2091 11 9 11C6.79086 11 5 9.20914 5 7C5 4.79086 6.79086 3 9 3C11.2091 3 13 4.79086 13 7Z" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M22 21V19C22.006 18.1086 21.7141 17.2407 21.1706 16.5342C20.6271 15.8276 19.8631 15.3228 19 15.1M16 3.10001C16.8837 3.30141 17.6729 3.79699 18.2381 4.50554C18.8033 5.21409 19.1112 6.09361 19.1112 7.00001C19.1112 7.9064 18.8033 8.78592 18.2381 9.49447C17.6729 10.203 16.8837 10.6986 16 10.9" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'x':
      return (
        <>
          <Path d="M6 6L12 12M12 12L18 18M12 12L18 6M12 12L6 18" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'zap':
      return (
        <>
          <Path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke={color} fill="none" strokeWidth={2.0} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
  }
}

export const REDESIGN_ICON_NAMES: RedesignIconName[] = [
  'alert',
  'arrow-left',
  'arrow-right',
  'bank',
  'bell',
  'calendar',
  'check',
  'chevron-down',
  'chevron-left',
  'chevron-right',
  'chevron-up',
  'clock',
  'cloud-off',
  'edit',
  'export',
  'eye',
  'eye-off',
  'file',
  'filter',
  'flow',
  'home',
  'import',
  'info',
  'list',
  'lock',
  'logout',
  'menu',
  'more',
  'pie',
  'plus',
  'pulse',
  'refresh',
  'repeat',
  'search',
  'select',
  'sliders',
  'swap',
  'target',
  'trash',
  'trending-up',
  'user',
  'users',
  'x',
  'zap',
];
