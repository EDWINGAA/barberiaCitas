/**
 * Barril de componentes de interfaz.
 * Permite importar todo desde un unico sitio:
 *   import { Button, Card, Modal } from '@/components/ui'
 */

export { Button, IconButton } from './Button'
export { Card, CardHeader, StatCard, Section } from './Card'
export {
  Badge,
  AppointmentStatusBadge,
  CourseStatusBadge,
  CourseLevelBadge,
  CourseModalityBadge,
  EnrollmentStatusBadge,
  PaymentStatusBadge,
} from './Badge'
export { Field, Input, PasswordInput, Textarea, Select, Checkbox, PillGroup } from './Input'
export { Modal, ConfirmDialog } from './Modal'
export {
  Spinner,
  FullPageLoader,
  Skeleton,
  SkeletonRow,
  SkeletonList,
  SkeletonStats,
  SkeletonCourseCard,
  SkeletonCourseGrid,
  EmptyState,
  ErrorState,
  FormError,
} from './Feedback'
export { Avatar, AvatarWithName, CourseCover } from './Avatar'
export { CapacityBar, ProgressBar, Tabs, ImageUpload, DataRow, Divider } from './Misc'
