import hasha from 'hasha';
import * as packageCache from '../../../util/cache/package';
import type { Http } from '../../../util/http';
import { joinUrlParts } from '../../../util/url';
import type { ReleaseResult } from '../types';
import { GemMetadata, GemVersions } from './schema';

interface CacheRecord {
  hash: string;
  data: ReleaseResult;
}

export class MetadataCache {
  constructor(private readonly http: Http) {}

  async getRelease(
    registryUrl: string,
    packageName: string,
    versions: string[]
  ): Promise<ReleaseResult> {
    const hash = hasha(versions, { algorithm: 'sha256' });
    const cacheNs = `datasource-rubygems`;
    const cacheKey = `metadata-cache:${registryUrl}:${packageName}`;
    const oldCache = await packageCache.get<CacheRecord>(cacheNs, cacheKey);
    if (oldCache?.hash === hash) {
      return oldCache.data;
    }

    const { body: releases } = await this.http.getJson(
      joinUrlParts(registryUrl, '/api/v1/versions', `${packageName}.json`),
      GemVersions
    );

    const { body: metadata } = await this.http.getJson(
      joinUrlParts(registryUrl, '/api/v1/gems', `${packageName}.json`),
      GemMetadata
    );

    const data: ReleaseResult = { releases };

    if (metadata.changelogUrl) {
      data.changelogUrl = metadata.changelogUrl;
    }

    if (metadata.sourceUrl) {
      data.sourceUrl = metadata.sourceUrl;
    }

    if (metadata.homepage) {
      data.homepage = metadata.homepage;
    }

    const newCache: CacheRecord = { hash, data };
    const ttlMinutes = 100 * 24 * 60;
    const ttlRandomDelta = Math.floor(Math.random() * 10 * 24 * 60);
    await packageCache.set(
      cacheNs,
      cacheKey,
      newCache,
      ttlMinutes + ttlRandomDelta
    );

    return data;
  }
}
