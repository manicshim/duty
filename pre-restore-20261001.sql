-- MySQL dump 10.13  Distrib 8.4.9, for Linux (x86_64)
--
-- Host: localhost    Database: duty
-- ------------------------------------------------------
-- Server version	8.4.9

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `auth_email_code`
--

DROP TABLE IF EXISTS `auth_email_code`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_email_code` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code_hash` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `profile_token_hash` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `level` int DEFAULT NULL,
  `name` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expires_at` datetime(3) NOT NULL,
  `verified_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `IDX_53b7d9626ad87f66a27d83efcf` (`email`,`provider`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_email_code`
--

LOCK TABLES `auth_email_code` WRITE;
/*!40000 ALTER TABLE `auth_email_code` DISABLE KEYS */;
/*!40000 ALTER TABLE `auth_email_code` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `duty_calendar`
--

DROP TABLE IF EXISTS `duty_calendar`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `duty_calendar` (
  `id` int NOT NULL AUTO_INCREMENT,
  `duty_date` date NOT NULL,
  `duty_code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `duty_label` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_row` int DEFAULT NULL,
  `source_col` int DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `member_id` int DEFAULT NULL,
  `upload_log_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_24f5b789f918bcbf2b603a64e6` (`member_id`,`duty_date`),
  KEY `FK_9d1c4e4167abc4bcea0c7e064cb` (`upload_log_id`),
  CONSTRAINT `FK_91a105be975a892f5fd69221eb6` FOREIGN KEY (`member_id`) REFERENCES `member` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_9d1c4e4167abc4bcea0c7e064cb` FOREIGN KEY (`upload_log_id`) REFERENCES `upload_log` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `duty_calendar`
--

LOCK TABLES `duty_calendar` WRITE;
/*!40000 ALTER TABLE `duty_calendar` DISABLE KEYS */;
/*!40000 ALTER TABLE `duty_calendar` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `manager_member_dayoff`
--

DROP TABLE IF EXISTS `manager_member_dayoff`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `manager_member_dayoff` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dayoff_date` date NOT NULL,
  `memo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `member_id` int DEFAULT NULL,
  `master_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_47dd3a6edf9dd5579222e598c3e` (`member_id`),
  KEY `FK_a5e07dfd29cfbb35853569d0e79` (`master_id`),
  CONSTRAINT `FK_47dd3a6edf9dd5579222e598c3e` FOREIGN KEY (`member_id`) REFERENCES `member` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_a5e07dfd29cfbb35853569d0e79` FOREIGN KEY (`master_id`) REFERENCES `master` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `manager_member_dayoff`
--

LOCK TABLES `manager_member_dayoff` WRITE;
/*!40000 ALTER TABLE `manager_member_dayoff` DISABLE KEYS */;
/*!40000 ALTER TABLE `manager_member_dayoff` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `master`
--

DROP TABLE IF EXISTS `master`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `master` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ms_id` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ms_lv` int NOT NULL DEFAULT '1',
  `ms_name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ms_phone` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section_permissions` json DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_7f580d1109d22867ad9e4226b0` (`ms_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `master`
--

LOCK TABLES `master` WRITE;
/*!40000 ALTER TABLE `master` DISABLE KEYS */;
/*!40000 ALTER TABLE `master` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `master_signup_request`
--

DROP TABLE IF EXISTS `master_signup_request`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `master_signup_request` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `level` int NOT NULL DEFAULT '1',
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `approved_by` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `rejected_by` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rejected_at` datetime DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `master_signup_request`
--

LOCK TABLES `master_signup_request` WRITE;
/*!40000 ALTER TABLE `master_signup_request` DISABLE KEYS */;
/*!40000 ALTER TABLE `master_signup_request` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `member`
--

DROP TABLE IF EXISTS `member`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `member` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mb_id` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mb_phone` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mb_lv` int NOT NULL DEFAULT '1',
  `mb_name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mb_department` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mb_sort_order` int DEFAULT NULL,
  `mb_is_tester` tinyint NOT NULL DEFAULT '0',
  `mb_hidden` tinyint NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `grade_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_6edd11ad286b665ba6f7657dd3` (`mb_id`),
  KEY `FK_2f86fe79bc97cd883aeb00d4d9c` (`grade_id`),
  CONSTRAINT `FK_2f86fe79bc97cd883aeb00d4d9c` FOREIGN KEY (`grade_id`) REFERENCES `member_grade` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `member`
--

LOCK TABLES `member` WRITE;
/*!40000 ALTER TABLE `member` DISABLE KEYS */;
/*!40000 ALTER TABLE `member` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `member_grade`
--

DROP TABLE IF EXISTS `member_grade`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `member_grade` (
  `id` int NOT NULL AUTO_INCREMENT,
  `grade_code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `grade_name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_71418277077eca6d5340afaeda` (`grade_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `member_grade`
--

LOCK TABLES `member_grade` WRITE;
/*!40000 ALTER TABLE `member_grade` DISABLE KEYS */;
/*!40000 ALTER TABLE `member_grade` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `member_oauth_account`
--

DROP TABLE IF EXISTS `member_oauth_account`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `member_oauth_account` (
  `id` int NOT NULL AUTO_INCREMENT,
  `provider` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `member_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_7fc2a4b9dac6392bc77ca96920` (`provider`,`email`),
  KEY `FK_c5d45f4a41bbea698d6921db2ce` (`member_id`),
  CONSTRAINT `FK_c5d45f4a41bbea698d6921db2ce` FOREIGN KEY (`member_id`) REFERENCES `member` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `member_oauth_account`
--

LOCK TABLES `member_oauth_account` WRITE;
/*!40000 ALTER TABLE `member_oauth_account` DISABLE KEYS */;
/*!40000 ALTER TABLE `member_oauth_account` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `member_wanted_leave`
--

DROP TABLE IF EXISTS `member_wanted_leave`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `member_wanted_leave` (
  `id` int NOT NULL AUTO_INCREMENT,
  `leave_date` date NOT NULL,
  `reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'requested',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `member_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_7111da57e351396171e1e758ef7` (`member_id`),
  CONSTRAINT `FK_7111da57e351396171e1e758ef7` FOREIGN KEY (`member_id`) REFERENCES `member` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `member_wanted_leave`
--

LOCK TABLES `member_wanted_leave` WRITE;
/*!40000 ALTER TABLE `member_wanted_leave` DISABLE KEYS */;
/*!40000 ALTER TABLE `member_wanted_leave` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `upload_log`
--

DROP TABLE IF EXISTS `upload_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `upload_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `original_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stored_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `target_year` int NOT NULL,
  `target_month` int NOT NULL,
  `row_count` int NOT NULL DEFAULT '0',
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'success',
  `message` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `upload_log`
--

LOCK TABLES `upload_log` WRITE;
/*!40000 ALTER TABLE `upload_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `upload_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'duty'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-01 19:17:20
