import { Slot } from 'expo-router';

/** The dashboard has its own navigation, so the starter tab bar is not needed on web. */
export default function AppTabs() {
  return <Slot />;
}
