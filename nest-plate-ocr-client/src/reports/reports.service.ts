import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaterialTrip } from '../material-trips/material-trip.entity';
import { ReportQueryDto } from './report.dto';

type AggregateRow = {
  key: string;
  name: string;
  unit?: string;
  quantity: number;
  cost: number;
  trips: number;
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(MaterialTrip)
    private readonly materialTripsRepository: Repository<MaterialTrip>,
  ) {}

  async overview(query: ReportQueryDto) {
    const trips = await this.findTrips(query);

    const byMaterial = new Map<string, AggregateRow>();
    const bySupplier = new Map<string, AggregateRow>();
    const byDay = new Map<string, AggregateRow>();

    let totalQuantity = 0;
    let totalCost = 0;

    for (const trip of trips) {
      const quantity = Number(trip.quantity || 0);
      const cost = Number(trip.totalPrice || 0);
      totalQuantity += quantity;
      totalCost += cost;

      this.addAggregate(byMaterial, trip.materialId, trip.material?.name || 'Unknown', quantity, cost, trip.material?.unit);
      this.addAggregate(bySupplier, trip.supplierId, trip.supplier?.name || 'Unknown', quantity, cost);
      this.addAggregate(byDay, this.dayKey(trip.occurredAt), this.dayKey(trip.occurredAt), quantity, cost);
    }

    return {
      filters: query,
      totals: {
        trips: trips.length,
        quantity: totalQuantity,
        cost: totalCost,
        averageCostPerTrip: trips.length ? totalCost / trips.length : 0,
      },
      byMaterial: this.sortAggregates(byMaterial),
      bySupplier: this.sortAggregates(bySupplier),
      byDay: this.sortAggregates(byDay, 'key'),
      recentTrips: trips.slice(0, 10),
    };
  }

  private findTrips(query: ReportQueryDto) {
    const qb = this.materialTripsRepository.createQueryBuilder('trip');
    qb.leftJoinAndSelect('trip.project', 'project')
      .leftJoinAndSelect('trip.material', 'material')
      .leftJoinAndSelect('trip.supplier', 'supplier')
      .leftJoinAndSelect('trip.importPlan', 'importPlan')
      .orderBy('trip.occurredAt', 'DESC');

    if (query.projectId) {
      qb.andWhere('trip.projectId = :projectId', { projectId: query.projectId });
    }
    if (query.materialId) {
      qb.andWhere('trip.materialId = :materialId', { materialId: query.materialId });
    }
    if (query.supplierId) {
      qb.andWhere('trip.supplierId = :supplierId', { supplierId: query.supplierId });
    }
    if (query.from) {
      qb.andWhere('trip.occurredAt >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      qb.andWhere('trip.occurredAt <= :to', { to: new Date(query.to) });
    }

    return qb.getMany();
  }

  private addAggregate(
    map: Map<string, AggregateRow>,
    key: string,
    name: string,
    quantity: number,
    cost: number,
    unit?: string,
  ) {
    const current = map.get(key) || {
      key,
      name,
      unit,
      quantity: 0,
      cost: 0,
      trips: 0,
    };

    current.quantity += quantity;
    current.cost += cost;
    current.trips += 1;
    map.set(key, current);
  }

  private sortAggregates(map: Map<string, AggregateRow>, field: 'key' | 'cost' = 'cost') {
    return Array.from(map.values()).sort((a, b) => {
      if (field === 'key') {
        return a.key.localeCompare(b.key);
      }
      return b.cost - a.cost;
    });
  }

  private dayKey(value: Date) {
    return new Date(value).toISOString().slice(0, 10);
  }
}
