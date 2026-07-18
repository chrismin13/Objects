import { featureStyles } from "../feature-styles";
import { libraryStyles } from "../library-styles";
import { responsiveStyles } from "../responsive-styles";
import { styles } from "../styles";
import { tagStyles } from "../tag-styles";
import { thingsStyles } from "../things-styles";
import { webAwesomeTheme } from "../vendor/webawesome/theme";

// Order is intentional: upstream tokens, legacy base, responsive behavior,
// feature slices, Things visual language, then component-library parity fixes.
export const objectsTheme = [
  webAwesomeTheme,
  styles,
  responsiveStyles,
  featureStyles,
  tagStyles,
  thingsStyles,
  libraryStyles,
].join("\n");
