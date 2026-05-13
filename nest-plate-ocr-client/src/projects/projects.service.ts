import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { CreateProjectDto, UpdateProjectDto } from './project.dto';
import { Project } from './project.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
  ) {}

  create(dto: CreateProjectDto) {
    const project = this.projectsRepository.create({
      ...dto,
      status: dto.status ?? 'active',
      budget: dto.budget ?? 0,
    });
    return this.projectsRepository.save(project);
  }

  findAll(search?: string) {
    return this.projectsRepository.find({
      where: search
        ? [
            { code: ILike(`%${search}%`) },
            { name: ILike(`%${search}%`) },
            { location: ILike(`%${search}%`) },
          ]
        : undefined,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const project = await this.projectsRepository.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException('Project not found.');
    }
    return project;
  }

  async update(id: string, dto: UpdateProjectDto) {
    const project = await this.findOne(id);
    Object.assign(project, dto);
    return this.projectsRepository.save(project);
  }

  async remove(id: string) {
    const project = await this.findOne(id);
    await this.projectsRepository.remove(project);
    return { deleted: true };
  }
}
