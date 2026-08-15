import { featureStyles } from "../feature-styles";
import { libraryStyles } from "../library-styles";
import { mobileInteractionStyles } from "../mobile-interaction-styles";
import { responsiveStyles } from "../responsive-styles";
import { styles } from "../styles";
import { tagStyles } from "../tag-styles";
import { thingsStyles } from "../things-styles";
import { webAwesomeTheme } from "../vendor/webawesome/theme";
import { designTokens } from "./tokens";
import { settingsDialogStyles } from "../features/settings/settings-dialog-styles";
import { entityDialogStyles } from "../features/entities/entity-dialog-styles";

// Order is intentional: upstream tokens, legacy base, responsive behavior,
// feature slices, Things visual language, component-library parity fixes, then
// the final coarse-pointer interaction policy.
export const objectsTheme = [
  webAwesomeTheme,
  designTokens,
  styles,
  responsiveStyles,
  featureStyles,
  tagStyles,
  thingsStyles,
  libraryStyles,
  settingsDialogStyles,
  entityDialogStyles,
  mobileInteractionStyles,
].join("\n");
