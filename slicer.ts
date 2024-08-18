interface KeyRange {
  start_key: string;
  end_key: string;
  data_access_frequency: number;
  storage_utilization: number;
  request_processing_load: number;
  memory_usage: number;
}

export const weights: Weights = {
  cpuWeight: 0.5,
  memoryWeight: 0.5,
  storageWeight: 0.30000000000000004,
  accessFrequencyWeight: 0.1,
  migrationPenalty: 1,
};

export interface ServerReport {
  instance_id: string;
  total_storage_utilization: number;
  total_request_processing_load: number;
  total_data_access_frequency: number;
  total_memory_usage: number;
  max_cpu_capacity: number;
  max_memory_capacity: number;
  key_ranges: KeyRange[];
}

export interface MigrationPlan {
  start_key: string;
  end_key: string;
  source_instance: string;
  destination_instance: string;
}

export interface Weights {
  cpuWeight: number;
  memoryWeight: number;
  storageWeight: number;
  accessFrequencyWeight: number;
  migrationPenalty: number;
}

export function slicerLoadBalancer(
  servers: ServerReport[],
  weights: Weights
): MigrationPlan[] {
  const migrationPlans: MigrationPlan[] = [];

  // 1. Identify the most and least loaded servers based on a combined metric
  let mostLoadedServer: ServerReport | null = null;
  let leastLoadedServer: ServerReport | null = null;

  for (const server of servers) {
    if (
      !mostLoadedServer ||
      calculateCombinedLoad(server, weights) >
        calculateCombinedLoad(mostLoadedServer, weights)
    ) {
      mostLoadedServer = server;
    }
    if (
      !leastLoadedServer ||
      calculateCombinedLoad(server, weights) <
        calculateCombinedLoad(leastLoadedServer, weights)
    ) {
      leastLoadedServer = server;
    }
  }

  // 2. Check for significant load imbalance
  if (mostLoadedServer && leastLoadedServer) {
    const loadDifference =
      calculateCombinedLoad(mostLoadedServer, weights) -
      calculateCombinedLoad(leastLoadedServer, weights);
    if (
      loadDifference >
      0.1 * calculateCombinedLoad(mostLoadedServer, weights)
    ) {
      // 3. Identify the most loaded key range within the most loaded server based on the combined metric
      const keyRangeToMove = mostLoadedServer.key_ranges.reduce(
        (prev, current) =>
          calculateKeyRangeLoad(current, weights) >
          calculateKeyRangeLoad(prev, weights)
            ? current
            : prev,
        mostLoadedServer.key_ranges[0]
      );

      // 4. Decide whether to move or split the key range
      if (shouldSplitKeyRange(keyRangeToMove, leastLoadedServer)) {
        const [range1, range2] = splitKeyRange(
          keyRangeToMove,
          servers,
          weights
        );
        migrationPlans.push(
          createMigrationPlan(
            range1,
            mostLoadedServer.instance_id,
            range1.destination_instance!
          )
        );
        migrationPlans.push(
          createMigrationPlan(
            range2,
            mostLoadedServer.instance_id,
            range2.destination_instance!
          )
        );
      } else if (canMoveKeyRange(keyRangeToMove, leastLoadedServer)) {
        migrationPlans.push(
          createMigrationPlan(
            keyRangeToMove,
            mostLoadedServer.instance_id,
            leastLoadedServer.instance_id
          )
        );
      }
    }
  }

  return migrationPlans;
}

// Determine if a key range should be split based on combined load and server capacity
function shouldSplitKeyRange(
  keyRange: KeyRange,
  server: ServerReport
): boolean {
  const projectedCpuUsage =
    server.total_request_processing_load + keyRange.request_processing_load;
  const projectedMemoryUsage =
    server.total_memory_usage + keyRange.memory_usage;

  return (
    projectedCpuUsage > server.max_cpu_capacity ||
    projectedMemoryUsage > server.max_memory_capacity
  );
}

// Placeholder function for calculating the midpoint of a key range
function calculateMidKey(startKey: string, endKey: string): string {
  const startChar = startKey.charCodeAt(0);
  const endChar = endKey.charCodeAt(0);
  const midChar = String.fromCharCode(Math.floor((startChar + endChar) / 2));
  return midChar;
}
// Split a key range into two sub-ranges and determine their destination servers
function splitKeyRange(
  keyRange: KeyRange,
  availableServers: ServerReport[],
  weights: Weights
): [
  KeyRange & { destination_instance?: string },
  KeyRange & { destination_instance?: string }
] {
  const midKey = calculateMidKey(keyRange.start_key, keyRange.end_key);
  const sortedServers = availableServers.sort(
    (a, b) =>
      calculateCombinedLoad(a, weights) - calculateCombinedLoad(b, weights)
  );

  const range1: KeyRange & { destination_instance?: string } = {
    ...keyRange,
    end_key: midKey,
    request_processing_load: keyRange.request_processing_load / 2,
    storage_utilization: keyRange.storage_utilization / 2,
    data_access_frequency: keyRange.data_access_frequency / 2,
    memory_usage: keyRange.memory_usage / 2,
    destination_instance: sortedServers[0].instance_id,
  };

  const range2: KeyRange & { destination_instance?: string } = {
    ...keyRange,
    start_key: midKey,
    request_processing_load: keyRange.request_processing_load / 2,
    storage_utilization: keyRange.storage_utilization / 2,
    data_access_frequency: keyRange.data_access_frequency / 2,
    memory_usage: keyRange.memory_usage / 2,
    destination_instance:
      sortedServers[1]?.instance_id || sortedServers[0].instance_id,
  };

  return [range1, range2];
}

// Check if a key range can be moved to a destination server without exceeding its capacity
function canMoveKeyRange(keyRange: KeyRange, server: ServerReport): boolean {
  const projectedCpuUsage =
    server.total_request_processing_load + keyRange.request_processing_load;
  const projectedMemoryUsage =
    server.total_memory_usage + keyRange.memory_usage;

  return (
    projectedCpuUsage <= server.max_cpu_capacity &&
    projectedMemoryUsage <= server.max_memory_capacity
  );
}
// Calculate the combined load metric for a server
export function calculateCombinedLoad(
  server: ServerReport,
  weights: Weights
): number {
  return (
    server.total_request_processing_load * weights.cpuWeight +
    server.total_storage_utilization * weights.storageWeight +
    server.total_data_access_frequency * weights.accessFrequencyWeight +
    server.total_memory_usage * weights.memoryWeight
  );
}

// Calculate the load contribution of a single key range
function calculateKeyRangeLoad(keyRange: KeyRange, weights: Weights): number {
  return (
    keyRange.request_processing_load * weights.cpuWeight +
    keyRange.storage_utilization * weights.storageWeight +
    keyRange.data_access_frequency * weights.accessFrequencyWeight +
    keyRange.memory_usage * weights.memoryWeight
  );
}

// Create a migration plan for a key range
function createMigrationPlan(
  keyRange: KeyRange & { destination_instance?: string },
  source: string,
  destination: string
): MigrationPlan {
  return {
    start_key: keyRange.start_key,
    end_key: keyRange.end_key,
    source_instance: source,
    destination_instance: destination,
  };
}
