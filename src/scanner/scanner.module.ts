import { Module } from "@nestjs/common";
import { ScannerResolver } from "./resolvers/scanner.resolver";
import { ScannerService } from "./services/scanner.service";

@Module({
  providers: [ScannerResolver, ScannerService],
})
export class ScannerModule {}
