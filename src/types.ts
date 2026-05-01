export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  role: 'admin' | 'user';
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  photoURL?: string;
  ownerId: string;
  shortId: string;
  members: string[];
  createdAt: any; // Firestore Timestamp
  updatedAt?: any; // Added for traceability
  ganttStartDate?: any; // Start date of Gantt Chart timeline
}

export interface Board {
  id: string;
  projectId: string;
  name: string;
  order: number;
  color?: string;
  ownerId: string; // Added for security
  createdAt: any;
  updatedAt?: any;
}

export interface Task {
  id: string;
  projectId: string;
  boardId: string;
  title: string;
  description?: string;
  assignedTo?: string | string[]; // Support single string (legacy) and array
  order: number;
  color?: string;
  createdAt: any; // Firestore Timestamp
  updatedAt?: any; // Added for traceability
  ownerId: string; // Added for traceability (unifying authorId)
  startDate?: any; // Firestore Timestamp
  dueDate?: any; // Firestore Timestamp
  tags?: string[];
}

export interface QuadroNode {
  id: string;
  projectId: string; // Added for security and indexing
  type: string;
  position: { x: number; y: number };
  data: { label: string; color?: string; [key: string]: any };
  style?: any;
  createdBy: string; // Track who created the node
  createdAt: any;
}

export interface QuadroEdge {
  id: string;
  projectId: string; // Added for security and indexing
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
  style?: any;
  createdBy: string; // Track who created the edge
  createdAt: any;
}

export interface Quadro {
  id: string;
  projectId: string;
  name: string;
  nodes: QuadroNode[];
  edges: QuadroEdge[];
  createdAt: any;
  updatedAt: any;
  ownerId: string;
}

export interface InventoryItem {
  id: string;
  projectId: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  location: string; // Depósito
  tags: string[];
  assignedTo: string[]; // Responsáveis (Array de UIDs)
  taskId?: string; // Link para tarefa do Kanban
  createdAt: any;
  updatedAt: any;
}

export interface ProjectTag {
  id: string;
  projectId: string;
  label: string;
  color: string;
  createdAt: any;
}

export interface AssetFolder {
  id: string;
  projectId: string;
  parentId?: string | null; // Support nested folders
  name: string;
  order: number;
  createdAt: any;
  updatedAt: any;
  ownerId: string;
}
export interface AssetLink {
  id: string;
  folderId?: string; // Optional for root assets
  projectId: string;
  name: string;
  url: string;
  createdAt: any;
  updatedAt: any;
  ownerId: string;
}

export interface AssetDocument {
  id: string;
  projectId: string;
  folderId?: string | null;
  type: 'note';
  title: string;
  content: Record<string, any>; // TipTap JSON content
  ownerId: string;
  createdAt: any;
  updatedAt: any;
}

export interface RACIMatrix {
  id: string;
  projectId: string;
  name: string;
  createdAt: any;
  updatedAt: any;
  ownerId: string;
}

export interface RACITask {
  id: string;
  matrixId: string;
  projectId: string;
  title: string;
  order: number;
  createdAt: any;
}

export interface RACIStakeholder {
  id: string;
  matrixId: string;
  projectId: string;
  name: string;
  role?: string;
  userId?: string;
  order: number;
  createdAt: any;
}

export type RACIRole = 'R' | 'A' | 'C' | 'I' | null;

export interface RACIAssignment {
  id: string;
  matrixId: string;
  projectId: string;
  taskId: string;
  participantId: string; // User UID or Stakeholder ID
  role: RACIRole;
  updatedAt: any;
}

export interface GanttTask {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  section?: string; // e.g. ENGENHARIA, PROJETO SOCIAL
  category?: string; // e.g. MILESTONE, HIGH RISK, GOAL...
  dependencies?: string; // Custom arbitrary text
  assignedTo?: string[]; // Array of projectMember UIDs or ProjectStakeholder IDs
  startDate: any; // Firestore Timestamp
  endDate: any; // Firestore Timestamp
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  progress: number; // 0-100
  color?: string;
  order: number;
  createdAt: any;
  updatedAt: any;
}

export interface ProjectStakeholder {
  id: string;
  projectId: string;
  name: string;
  role?: string;
  userId?: string; // If it's a project member
  photoURL?: string;
  createdAt: any;
}

export interface Transaction {
  id: string;
  projectId: string;
  title: string;
  amount: number;
  date: any; // Firestore Timestamp
  category: string;
  type: 'income' | 'expense';
  budgetId?: string; // Links this transaction to a specific budget
  receiptUrl?: string; // Uploaded receipt image link
  createdAt: any; // Firestore Timestamp
}

export interface Budget {
  id: string;
  projectId: string;
  name: string;
  amount: number;
  date: string; // 'YYYY-MM'
  createdAt: any; // Firestore Timestamp
}
