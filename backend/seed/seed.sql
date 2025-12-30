SET FOREIGN_KEY_CHECKS=0;
SET UNIQUE_CHECKS=0;

-- MySQL dump 10.13  Distrib 9.5.0, for macos26.1 (arm64)
--
-- Host: localhost    Database: ebusiness_courses
-- ------------------------------------------------------
-- Server version	9.5.0

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
-- Table structure for table `attribute_values`
--

DROP TABLE IF EXISTS `attribute_values`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attribute_values` (
  `id` int NOT NULL AUTO_INCREMENT,
  `attribute_id` int NOT NULL,
  `value` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_attr_val` (`attribute_id`,`value`),
  CONSTRAINT `fk_attr_values_attr` FOREIGN KEY (`attribute_id`) REFERENCES `attributes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attribute_values`
--

LOCK TABLES `attribute_values` WRITE;
/*!40000 ALTER TABLE `attribute_values` DISABLE KEYS */;
INSERT INTO `attribute_values` VALUES (3,1,'Напреднал'),(1,1,'Начинаещ'),(2,1,'Средно ниво'),(5,2,'Английски'),(4,2,'Български'),(6,3,'Видео'),(7,3,'Документ'),(8,3,'Смесен');
/*!40000 ALTER TABLE `attribute_values` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attributes`
--

DROP TABLE IF EXISTS `attributes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attributes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attributes`
--

LOCK TABLES `attributes` WRITE;
/*!40000 ALTER TABLE `attributes` DISABLE KEYS */;
INSERT INTO `attributes` VALUES (1,'level','Ниво'),(2,'language','Език'),(3,'format','Формат');
/*!40000 ALTER TABLE `attributes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `department_id` int NOT NULL,
  `parent_id` int DEFAULT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cat` (`department_id`,`parent_id`,`name`),
  KEY `fk_categories_parent` (`parent_id`),
  KEY `idx_categories_department` (`department_id`),
  CONSTRAINT `fk_categories_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_categories_parent` FOREIGN KEY (`parent_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categories`
--

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` VALUES (1,1,NULL,'Уеб разработка','Frontend/Backend основи, практики и инструменти'),(2,1,NULL,'Бази данни','SQL, моделиране на данни и практическа работа'),(3,1,NULL,'Данни и AI','Анализ на данни, основи на машинно обучение'),(4,2,NULL,'Математика','Функции, уравнения, вероятности, упражнения'),(5,2,NULL,'Статистика','Описателна статистика, разпределения, анализ'),(6,2,NULL,'Логика и алгоритми','Логическо мислене, алгоритмични задачи и подходи'),(7,3,NULL,'Дигитален маркетинг','SEO, реклами, съдържание, аналитика'),(8,3,NULL,'Управление на проекти','Планиране, изпълнение, контрол, Agile/RUP'),(9,3,NULL,'Електронна търговия','Онлайн продажби, процеси, операции и модели'),(11,5,NULL,'Английски','Общ английски, граматика, разговорни умения'),(12,5,NULL,'Испански','Основи, произношение, разговорни теми'),(13,5,NULL,'Немски','Граматика, лексика, подготовка за ежедневни ситуации'),(14,6,NULL,'Домашен хляб','Тесто, закваска, печене и техники'),(15,6,NULL,'Ферментация','Кисело зеле, комбуча, кимчи, полезни бактерии'),(16,6,NULL,'Вино и напитки','Домашно вино, дегустация, базови процеси'),(17,7,NULL,'Домашни ремонти','Практически ремонти и базови инструменти'),(18,7,NULL,'Ръчна изработка','Декорации, подаръци, малки проекти'),(19,7,NULL,'Градинарство','Сезонни грижи, разсад, почва и поливане'),(20,1,1,'Frontend','HTML, CSS, JavaScript'),(21,1,1,'Backend','APIs, databases, auth');
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `course_attribute_values`
--

DROP TABLE IF EXISTS `course_attribute_values`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `course_attribute_values` (
  `course_id` int NOT NULL,
  `attribute_value_id` int NOT NULL,
  PRIMARY KEY (`course_id`,`attribute_value_id`),
  KEY `fk_cav_attr_value` (`attribute_value_id`),
  CONSTRAINT `fk_cav_attr_value` FOREIGN KEY (`attribute_value_id`) REFERENCES `attribute_values` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_cav_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `course_attribute_values`
--

LOCK TABLES `course_attribute_values` WRITE;
/*!40000 ALTER TABLE `course_attribute_values` DISABLE KEYS */;
INSERT INTO `course_attribute_values` VALUES (1,1),(4,1),(7,1),(10,1),(13,1),(16,1),(19,1),(22,1),(25,1),(28,1),(31,1),(34,1),(37,1),(40,1),(43,1),(46,1),(49,1),(52,1),(55,1),(58,1),(61,1),(64,1),(67,1),(70,1),(130,1),(133,1),(136,1),(139,1),(142,1),(145,1),(148,1),(151,1),(154,1),(157,1),(160,1),(163,1),(166,1),(169,1),(172,1),(175,1),(178,1),(181,1),(184,1),(187,1),(190,1),(193,1),(196,1),(199,1),(201,1),(202,1),(203,1),(204,1),(205,1),(206,1),(207,1),(208,1),(2,2),(5,2),(8,2),(11,2),(14,2),(17,2),(20,2),(23,2),(26,2),(29,2),(32,2),(35,2),(38,2),(41,2),(44,2),(47,2),(50,2),(53,2),(56,2),(59,2),(62,2),(65,2),(68,2),(71,2),(131,2),(134,2),(137,2),(140,2),(143,2),(146,2),(149,2),(152,2),(155,2),(158,2),(161,2),(164,2),(167,2),(170,2),(173,2),(176,2),(179,2),(182,2),(185,2),(188,2),(191,2),(194,2),(197,2),(200,2),(3,3),(6,3),(9,3),(12,3),(15,3),(18,3),(21,3),(24,3),(27,3),(30,3),(33,3),(36,3),(39,3),(42,3),(45,3),(48,3),(51,3),(54,3),(57,3),(60,3),(63,3),(66,3),(69,3),(72,3),(129,3),(132,3),(135,3),(138,3),(141,3),(144,3),(147,3),(150,3),(153,3),(156,3),(159,3),(162,3),(165,3),(168,3),(171,3),(174,3),(177,3),(180,3),(183,3),(186,3),(189,3),(192,3),(195,3),(198,3),(1,4),(3,4),(5,4),(7,4),(9,4),(11,4),(13,4),(15,4),(17,4),(19,4),(21,4),(23,4),(25,4),(27,4),(29,4),(31,4),(33,4),(35,4),(37,4),(39,4),(41,4),(43,4),(45,4),(47,4),(49,4),(51,4),(53,4),(55,4),(57,4),(59,4),(61,4),(63,4),(65,4),(67,4),(69,4),(71,4),(129,4),(131,4),(133,4),(135,4),(137,4),(139,4),(141,4),(143,4),(145,4),(147,4),(149,4),(151,4),(153,4),(154,4),(155,4),(156,4),(157,4),(158,4),(159,4),(160,4),(161,4),(162,4),(163,4),(164,4),(165,4),(166,4),(167,4),(168,4),(169,4),(170,4),(171,4),(172,4),(173,4),(174,4),(175,4),(176,4),(177,4),(178,4),(179,4),(180,4),(181,4),(182,4),(183,4),(184,4),(185,4),(186,4),(187,4),(188,4),(189,4),(190,4),(191,4),(192,4),(193,4),(194,4),(195,4),(196,4),(197,4),(198,4),(199,4),(200,4),(2,5),(4,5),(6,5),(8,5),(10,5),(12,5),(14,5),(16,5),(18,5),(20,5),(22,5),(24,5),(26,5),(28,5),(30,5),(32,5),(34,5),(36,5),(38,5),(40,5),(42,5),(44,5),(46,5),(48,5),(50,5),(52,5),(54,5),(56,5),(58,5),(60,5),(62,5),(64,5),(66,5),(68,5),(70,5),(72,5),(130,5),(132,5),(134,5),(136,5),(138,5),(140,5),(142,5),(144,5),(146,5),(148,5),(150,5),(152,5),(201,5),(202,5),(203,5),(204,5),(205,5),(206,5),(207,5),(208,5),(1,6),(4,6),(7,6),(10,6),(13,6),(16,6),(19,6),(22,6),(25,6),(28,6),(31,6),(34,6),(37,6),(40,6),(43,6),(46,6),(49,6),(52,6),(55,6),(58,6),(61,6),(64,6),(67,6),(70,6),(130,6),(133,6),(136,6),(139,6),(142,6),(145,6),(148,6),(151,6),(154,6),(157,6),(160,6),(163,6),(166,6),(169,6),(172,6),(175,6),(178,6),(181,6),(184,6),(187,6),(190,6),(193,6),(196,6),(199,6),(201,6),(202,6),(203,6),(204,6),(205,6),(206,6),(207,6),(208,6),(2,7),(5,7),(8,7),(11,7),(14,7),(17,7),(20,7),(23,7),(26,7),(29,7),(32,7),(35,7),(38,7),(41,7),(44,7),(47,7),(50,7),(53,7),(56,7),(59,7),(62,7),(65,7),(68,7),(71,7),(131,7),(134,7),(137,7),(140,7),(143,7),(146,7),(149,7),(152,7),(155,7),(158,7),(161,7),(164,7),(167,7),(170,7),(173,7),(176,7),(179,7),(182,7),(185,7),(188,7),(191,7),(194,7),(197,7),(200,7),(3,8),(6,8),(9,8),(12,8),(15,8),(18,8),(21,8),(24,8),(27,8),(30,8),(33,8),(36,8),(39,8),(42,8),(45,8),(48,8),(51,8),(54,8),(57,8),(60,8),(63,8),(66,8),(69,8),(72,8),(129,8),(132,8),(135,8),(138,8),(141,8),(144,8),(147,8),(150,8),(153,8),(156,8),(159,8),(162,8),(165,8),(168,8),(171,8),(174,8),(177,8),(180,8),(183,8),(186,8),(189,8),(192,8),(195,8),(198,8);
/*!40000 ALTER TABLE `course_attribute_values` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `courses`
--

DROP TABLE IF EXISTS `courses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `courses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category_id` int NOT NULL,
  `title` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `is_published` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_courses_category` (`category_id`),
  KEY `idx_courses_title` (`title`),
  CONSTRAINT `fk_courses_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=209 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `courses`
--

LOCK TABLES `courses` WRITE;
/*!40000 ALTER TABLE `courses` DISABLE KEYS */;
INSERT INTO `courses` VALUES (1,3,'Data & AI – Course 8','Practical course in Data & AI. Module 8.',0.00,1,'2025-12-27 09:37:00'),(2,3,'Data & AI – Course 7','Practical course in Data & AI. Module 7.',0.00,1,'2025-12-27 09:37:00'),(3,3,'Data & AI – Course 6','Practical course in Data & AI. Module 6.',49.99,1,'2025-12-27 09:37:00'),(4,3,'Data & AI – Course 5','Practical course in Data & AI. Module 5.',0.00,1,'2025-12-27 09:37:00'),(5,3,'Data & AI – Course 4','Practical course in Data & AI. Module 4.',0.00,1,'2025-12-27 09:37:00'),(6,3,'Data & AI – Course 3','Practical course in Data & AI. Module 3.',49.99,1,'2025-12-27 09:37:00'),(7,3,'Data & AI – Course 2','Practical course in Data & AI. Module 2.',0.00,1,'2025-12-27 09:37:00'),(8,3,'Data & AI – Course 1','Practical course in Data & AI. Module 1.',0.00,1,'2025-12-27 09:37:00'),(9,2,'Databases – Course 8','Practical course in Databases. Module 8.',0.00,1,'2025-12-27 09:37:00'),(10,2,'Databases – Course 7','Practical course in Databases. Module 7.',0.00,1,'2025-12-27 09:37:00'),(11,2,'Databases – Course 6','Practical course in Databases. Module 6.',49.99,1,'2025-12-27 09:37:00'),(12,2,'Databases – Course 5','Practical course in Databases. Module 5.',0.00,1,'2025-12-27 09:37:00'),(13,2,'Databases – Course 4','Practical course in Databases. Module 4.',0.00,1,'2025-12-27 09:37:00'),(14,2,'Databases – Course 3','Practical course in Databases. Module 3.',49.99,1,'2025-12-27 09:37:00'),(15,2,'Databases – Course 2','Practical course in Databases. Module 2.',0.00,1,'2025-12-27 09:37:00'),(16,2,'Databases – Course 1','Practical course in Databases. Module 1.',0.00,1,'2025-12-27 09:37:00'),(17,20,'Web Development – Course 8','Practical course in Web Development. Module 8.',0.00,1,'2025-12-27 09:37:00'),(18,20,'Web Development – Course 7','Practical course in Web Development. Module 7.',0.00,1,'2025-12-27 09:37:00'),(19,20,'Web Development – Course 6','Practical course in Web Development. Module 6.',49.99,1,'2025-12-27 09:37:00'),(20,20,'Web Development – Course 5','Practical course in Web Development. Module 5.',0.00,1,'2025-12-27 09:37:00'),(21,20,'Web Development – Course 4','Practical course in Web Development. Module 4.',0.00,1,'2025-12-27 09:37:00'),(22,20,'Web Development – Course 3','Practical course in Web Development. Module 3.',49.99,1,'2025-12-27 09:37:00'),(23,20,'Web Development – Course 2','Practical course in Web Development. Module 2.',0.00,1,'2025-12-27 09:37:00'),(24,20,'Web Development – Course 1','Practical course in Web Development. Module 1.',0.00,1,'2025-12-27 09:37:00'),(25,5,'Graphic Design – Course 8','Practical course in Graphic Design. Module 8.',0.00,1,'2025-12-27 09:37:00'),(26,5,'Graphic Design – Course 7','Practical course in Graphic Design. Module 7.',0.00,1,'2025-12-27 09:37:00'),(27,5,'Graphic Design – Course 6','Practical course in Graphic Design. Module 6.',49.99,1,'2025-12-27 09:37:00'),(28,5,'Graphic Design – Course 5','Practical course in Graphic Design. Module 5.',0.00,1,'2025-12-27 09:37:00'),(29,5,'Graphic Design – Course 4','Practical course in Graphic Design. Module 4.',0.00,1,'2025-12-27 09:37:00'),(30,5,'Graphic Design – Course 3','Practical course in Graphic Design. Module 3.',49.99,1,'2025-12-27 09:37:00'),(31,5,'Graphic Design – Course 2','Practical course in Graphic Design. Module 2.',0.00,1,'2025-12-27 09:37:00'),(32,5,'Graphic Design – Course 1','Practical course in Graphic Design. Module 1.',0.00,1,'2025-12-27 09:37:00'),(33,4,'UI/UX – Course 8','Practical course in UI/UX. Module 8.',0.00,1,'2025-12-27 09:37:00'),(34,4,'UI/UX – Course 7','Practical course in UI/UX. Module 7.',0.00,1,'2025-12-27 09:37:00'),(35,4,'UI/UX – Course 6','Practical course in UI/UX. Module 6.',49.99,1,'2025-12-27 09:37:00'),(36,4,'UI/UX – Course 5','Practical course in UI/UX. Module 5.',0.00,1,'2025-12-27 09:37:00'),(37,4,'UI/UX – Course 4','Practical course in UI/UX. Module 4.',0.00,1,'2025-12-27 09:37:00'),(38,4,'UI/UX – Course 3','Practical course in UI/UX. Module 3.',49.99,1,'2025-12-27 09:37:00'),(39,4,'UI/UX – Course 2','Practical course in UI/UX. Module 2.',0.00,1,'2025-12-27 09:37:00'),(40,4,'UI/UX – Course 1','Practical course in UI/UX. Module 1.',0.00,1,'2025-12-27 09:37:00'),(41,6,'Video Editing – Course 8','Practical course in Video Editing. Module 8.',0.00,1,'2025-12-27 09:37:00'),(42,6,'Video Editing – Course 7','Practical course in Video Editing. Module 7.',0.00,1,'2025-12-27 09:37:00'),(43,6,'Video Editing – Course 6','Practical course in Video Editing. Module 6.',49.99,1,'2025-12-27 09:37:00'),(44,6,'Video Editing – Course 5','Practical course in Video Editing. Module 5.',0.00,1,'2025-12-27 09:37:00'),(45,6,'Video Editing – Course 4','Practical course in Video Editing. Module 4.',0.00,1,'2025-12-27 09:37:00'),(46,6,'Video Editing – Course 3','Practical course in Video Editing. Module 3.',49.99,1,'2025-12-27 09:37:00'),(47,6,'Video Editing – Course 2','Practical course in Video Editing. Module 2.',0.00,1,'2025-12-27 09:37:00'),(48,6,'Video Editing – Course 1','Practical course in Video Editing. Module 1.',0.00,1,'2025-12-27 09:37:00'),(49,7,'Digital Marketing – Course 8','Practical course in Digital Marketing. Module 8.',0.00,1,'2025-12-27 09:37:00'),(50,7,'Digital Marketing – Course 7','Practical course in Digital Marketing. Module 7.',0.00,1,'2025-12-27 09:37:00'),(51,7,'Digital Marketing – Course 6','Practical course in Digital Marketing. Module 6.',49.99,1,'2025-12-27 09:37:00'),(52,7,'Digital Marketing – Course 5','Practical course in Digital Marketing. Module 5.',0.00,1,'2025-12-27 09:37:00'),(53,7,'Digital Marketing – Course 4','Practical course in Digital Marketing. Module 4.',0.00,1,'2025-12-27 09:37:00'),(54,7,'Digital Marketing – Course 3','Practical course in Digital Marketing. Module 3.',49.99,1,'2025-12-27 09:37:00'),(55,7,'Digital Marketing – Course 2','Practical course in Digital Marketing. Module 2.',0.00,1,'2025-12-27 09:37:00'),(56,7,'Digital Marketing – Course 1','Practical course in Digital Marketing. Module 1.',0.00,1,'2025-12-27 09:37:00'),(57,9,'E-commerce – Course 8','Practical course in E-commerce. Module 8.',0.00,1,'2025-12-27 09:37:00'),(58,9,'E-commerce – Course 7','Practical course in E-commerce. Module 7.',0.00,1,'2025-12-27 09:37:00'),(59,9,'E-commerce – Course 6','Practical course in E-commerce. Module 6.',49.99,1,'2025-12-27 09:37:00'),(60,9,'E-commerce – Course 5','Practical course in E-commerce. Module 5.',0.00,1,'2025-12-27 09:37:00'),(61,9,'E-commerce – Course 4','Practical course in E-commerce. Module 4.',0.00,1,'2025-12-27 09:37:00'),(62,9,'E-commerce – Course 3','Practical course in E-commerce. Module 3.',49.99,1,'2025-12-27 09:37:00'),(63,9,'E-commerce – Course 2','Practical course in E-commerce. Module 2.',0.00,1,'2025-12-27 09:37:00'),(64,9,'E-commerce – Course 1','Practical course in E-commerce. Module 1.',0.00,1,'2025-12-27 09:37:00'),(65,8,'Project Management – Course 8','Practical course in Project Management. Module 8.',0.00,1,'2025-12-27 09:37:00'),(66,8,'Project Management – Course 7','Practical course in Project Management. Module 7.',0.00,1,'2025-12-27 09:37:00'),(67,8,'Project Management – Course 6','Practical course in Project Management. Module 6.',49.99,1,'2025-12-27 09:37:00'),(68,8,'Project Management – Course 5','Practical course in Project Management. Module 5.',0.00,1,'2025-12-27 09:37:00'),(69,8,'Project Management – Course 4','Practical course in Project Management. Module 4.',0.00,1,'2025-12-27 09:37:00'),(70,8,'Project Management – Course 3','Practical course in Project Management. Module 3.',49.99,1,'2025-12-27 09:37:00'),(71,8,'Project Management – Course 2','Practical course in Project Management. Module 2.',0.00,1,'2025-12-27 09:37:00'),(72,8,'Project Management – Course 1','Practical course in Project Management. Module 1.',0.00,1,'2025-12-27 09:37:00'),(129,11,'Английски за начинаещи: основи','Азбука, произношение, базови изречения и ежедневни ситуации.',0.00,1,'2025-12-27 10:55:19'),(130,11,'Английска граматика без стрес','Времената обяснени ясно, с примери и упражнения.',19.90,1,'2025-12-27 10:55:19'),(131,11,'Разговорен английски: ежедневни теми','Диалози, слушане и увереност в говоренето.',24.90,1,'2025-12-27 10:55:19'),(132,11,'Английски за пътуване','Летища, хотели, ресторанти, спешни ситуации и полезни фрази.',14.90,1,'2025-12-27 10:55:19'),(133,11,'Бизнес английски: имейли и срещи','Структура на имейли, презентации, meeting фрази.',29.90,1,'2025-12-27 10:55:19'),(134,11,'Слушане и произношение: практикум','Упражнения за слух, акцент и правилна артикулация.',19.90,1,'2025-12-27 10:55:19'),(135,11,'Английски думи и колокации','Най-полезната лексика в контекст + mini тестове.',12.90,1,'2025-12-27 10:55:19'),(136,11,'Подготовка за интервю на английски','CV, въпроси/отговори и уверена комуникация.',34.90,1,'2025-12-27 10:55:19'),(137,12,'Испански от нула: старт','Произношение, основни фрази и ключова граматика.',0.00,1,'2025-12-27 10:55:19'),(138,12,'Разговорен испански: ежедневие','Пазар, транспорт, семейство, свободно време.',18.90,1,'2025-12-27 10:55:19'),(139,12,'Испански времена – ясно и практично','Настояще/минало/бъдеще с упражнения.',22.90,1,'2025-12-27 10:55:19'),(140,12,'Испански за пътуване','Хотел, ресторант, екскурзии, спешни ситуации.',14.90,1,'2025-12-27 10:55:19'),(141,12,'Лексика: 1000 думи за 30 дни','План за учене, повторение и контекст.',16.90,1,'2025-12-27 10:55:19'),(142,12,'Слушане и акцент: испански','Звуци, ритъм и разбиране на говор.',19.90,1,'2025-12-27 10:55:19'),(143,12,'Испански за работа: базова комуникация','Обаждания, кратки имейли, служебни фрази.',24.90,1,'2025-12-27 10:55:19'),(144,12,'Испански: мини разговорни сценарии','Практика с готови диалози и задачи.',12.90,1,'2025-12-27 10:55:19'),(145,13,'Немски за начинаещи: основи','Произношение, членове, базови структури.',0.00,1,'2025-12-27 10:55:19'),(146,13,'Немска граматика: падежи без паника','Nominativ/Akkusativ/Dativ – практично.',24.90,1,'2025-12-27 10:55:19'),(147,13,'Разговорен немски: ежедневни теми','Диалози за магазини, услуги, работа.',19.90,1,'2025-12-27 10:55:19'),(148,13,'Немски за пътуване','Хотел, транспорт, ориентация и полезни фрази.',14.90,1,'2025-12-27 10:55:19'),(149,13,'Немски думи в контекст','Лексика с примери, упражнения и повторение.',12.90,1,'2025-12-27 10:55:19'),(150,13,'Слушане и произношение: немски','Тренировки за звуци и разбиране на говор.',19.90,1,'2025-12-27 10:55:19'),(151,13,'Немски за работа: старт','Кратки имейли, фрази за срещи, представяне.',26.90,1,'2025-12-27 10:55:19'),(152,13,'Немски: подготовка за интервю','Практика с въпроси, отговори и речник.',34.90,1,'2025-12-27 10:55:20'),(153,14,'Домашен хляб: основи на тестото','Брашна, хидратация, месене и втасване.',0.00,1,'2025-12-27 10:55:20'),(154,14,'Закваска: старт и поддръжка','Как да създадеш закваска и да я поддържаш стабилна.',22.90,1,'2025-12-27 10:55:20'),(155,14,'Формоване и разрези','Техники за оформяне и красиви разрези преди печене.',16.90,1,'2025-12-27 10:55:20'),(156,14,'Печене: фурна, пара и температура','Как да постигнеш хрупкава коричка и мека среда.',19.90,1,'2025-12-27 10:55:20'),(157,14,'Хляб без месене','Лесна техника за отличен резултат с минимални усилия.',12.90,1,'2025-12-27 10:55:20'),(158,14,'Фокача и италиански стилове','Тесто, зехтин, топинги и правилно печене.',18.90,1,'2025-12-27 10:55:20'),(159,14,'Грешки при хляба и решения','Чести проблеми: гъста среда, плосък хляб, кисел вкус.',14.90,1,'2025-12-27 10:55:20'),(160,14,'Хляб за седмицата: план и съхранение','Планиране, замразяване и свежест.',10.90,1,'2025-12-27 10:55:20'),(161,15,'Ферментация: безопасност и основи','Хигиена, сол, температури и контрол на процеса.',0.00,1,'2025-12-27 10:55:20'),(162,15,'Кисело зеле: перфектната рецепта','Сол, време, буркани и как да избегнеш плесен.',14.90,1,'2025-12-27 10:55:20'),(163,15,'Кимчи за начинаещи','Основни съставки, паста, ферментация и съхранение.',19.90,1,'2025-12-27 10:55:20'),(164,15,'Комбуча: домашна практика','SCOBY, първа и втора ферментация, вкусове.',22.90,1,'2025-12-27 10:55:20'),(165,15,'Ферментирали зеленчуци: микс','Моркови, краставици, карфиол – техники и време.',16.90,1,'2025-12-27 10:55:20'),(166,15,'Ферментация без грешки','Най-честите проблеми и как да ги коригираш.',14.90,1,'2025-12-27 10:55:20'),(167,15,'Йогурт у дома: основи','Температура, закваска и плътност.',12.90,1,'2025-12-27 10:55:20'),(168,15,'Ферментация и вкус: дегустация','Киселинност, баланс, подправки и комбиниране.',18.90,1,'2025-12-27 10:55:20'),(169,16,'Домашно вино: стъпка по стъпка','От грозде до бутилка: базов процес и контрол.',0.00,1,'2025-12-27 10:55:20'),(170,16,'Избор на грозде и подготовка','Сортове, захарност, почистване и смачкване.',16.90,1,'2025-12-27 10:55:20'),(171,16,'Ферментация на вино: контрол','Температура, дрожди, съдове и проследяване.',22.90,1,'2025-12-27 10:55:20'),(172,16,'Претакане и избистряне','Кога, как и защо се прави; избистрящи техники.',18.90,1,'2025-12-27 10:55:20'),(173,16,'Бутилиране и съхранение','Стерилност, тапи, условия за съхранение.',14.90,1,'2025-12-27 10:55:20'),(174,16,'Дегустация: основи','Аромати, вкус, тяло, послевкус и как да описваш вино.',19.90,1,'2025-12-27 10:55:20'),(175,16,'Домашни ликьори и настойки','Плодови настойки, баланс на сладост и аромат.',16.90,1,'2025-12-27 10:55:20'),(176,16,'Чести проблеми при домашно вино','Окисляване, неприятни миризми и как да ги избегнеш.',14.90,1,'2025-12-27 10:55:20'),(177,17,'Домашни ремонти: инструменти и безопасност','Основни инструменти, защита и правилни навици.',0.00,1,'2025-12-27 10:55:20'),(178,17,'Пробиване и монтаж (стена/гипсокартон)','Дюбели, анкери, нивелиране и устойчив монтаж.',16.90,1,'2025-12-27 10:55:21'),(179,17,'Смяна на смесител и дребни ВиК ремонти','Уплътнения, течове и правилно затягане.',19.90,1,'2025-12-27 10:55:21'),(180,17,'Електро: безопасни дребни поправки','Какво е безопасно да правиш сам и какво – не.',22.90,1,'2025-12-27 10:55:21'),(181,17,'Боядисване: техника и подготовка','Подготовка на стени, грундиране и чисти ръбове.',18.90,1,'2025-12-27 10:55:21'),(182,17,'Силикон и фуги: баня/кухня','Сваляне, почистване и нанасяне без грешки.',14.90,1,'2025-12-27 10:55:21'),(183,17,'Малки мебелни поправки','Панти, дръжки, разхлабени връзки и укрепване.',12.90,1,'2025-12-27 10:55:21'),(184,17,'План за ремонт: бюджет и последователност','Как да планираш ремонт без излишни разходи.',14.90,1,'2025-12-27 10:55:21'),(185,18,'Ръчна изработка: старт с материали','Инструменти, лепила, основни материали и техника.',0.00,1,'2025-12-27 10:55:21'),(186,18,'Хартиени декорации и картички','Красиви картички, сгъвки, шаблони и композиция.',12.90,1,'2025-12-27 10:55:21'),(187,18,'Свещи у дома: основи','Восък, фитил, аромат, безопасност и форми.',16.90,1,'2025-12-27 10:55:21'),(188,18,'Сапуни: базови техники','Глицеринова база, добавки, форми и сушене.',18.90,1,'2025-12-27 10:55:21'),(189,18,'Макраме: първи стъпки','Възли, корди, малки проекти за начинаещи.',14.90,1,'2025-12-27 10:55:21'),(190,18,'Декупаж: практика','Подготовка, лепене, лак и финиш.',14.90,1,'2025-12-27 10:55:21'),(191,18,'Подаръци „handmade“: комплект идеи','Идеи, опаковки и презентация.',12.90,1,'2025-12-27 10:55:21'),(192,18,'Как да снимаш handmade продукт','Светлина, фон, кадри за онлайн продажба.',19.90,1,'2025-12-27 10:55:21'),(193,19,'Градинарство: старт за начинаещи','Почва, светлина, поливане и сезонност.',0.00,1,'2025-12-27 10:55:21'),(194,19,'Разсад у дома: стъпка по стъпка','Сеитба, пикиране и грижи до засаждане.',16.90,1,'2025-12-27 10:55:21'),(195,19,'Поливане и торене: баланс','Чести грешки и как да поддържаш растенията здрави.',14.90,1,'2025-12-27 10:55:21'),(196,19,'Подрязване и оформяне','Кога и как се подрязва – храсти, цветя, овошки.',18.90,1,'2025-12-27 10:55:21'),(197,19,'Компостиране: домашна система','Какво се компостира, слоеве и поддръжка.',12.90,1,'2025-12-27 10:55:21'),(198,19,'Билки на балкона','Мента, босилек, розмарин – грижи и реколта.',12.90,1,'2025-12-27 10:55:21'),(199,19,'Защита от вредители (без крайности)','Превенция, натурални методи и наблюдение.',16.90,1,'2025-12-27 10:55:21'),(200,19,'Градина по сезони: годишен план','Какво се прави всеки сезон и как да планираш.',14.90,1,'2025-12-27 10:55:21'),(201,21,'Backend Fundamentals 1','APIs, HTTP, routing and controllers.',0.00,1,'2025-12-27 12:44:38'),(202,21,'Backend Fundamentals 2','Databases, SQL basics and relationships.',0.00,1,'2025-12-27 12:44:38'),(203,21,'Backend Fundamentals 3','Authentication and authorization basics.',49.99,1,'2025-12-27 12:44:38'),(204,21,'Backend Fundamentals 4','REST patterns, pagination, filtering.',0.00,1,'2025-12-27 12:44:38'),(205,21,'Backend Fundamentals 5','Error handling, validation, middleware.',0.00,1,'2025-12-27 12:44:38'),(206,21,'Backend Fundamentals 6','Testing APIs and debugging.',49.99,1,'2025-12-27 12:44:38'),(207,21,'Backend Fundamentals 7','Deployment basics and environments.',0.00,1,'2025-12-27 12:44:38'),(208,21,'Backend Fundamentals 8','Security basics: OWASP, input safety.',0.00,1,'2025-12-27 12:44:38');
/*!40000 ALTER TABLE `courses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `departments`
--

DROP TABLE IF EXISTS `departments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `departments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `departments`
--

LOCK TABLES `departments` WRITE;
/*!40000 ALTER TABLE `departments` DISABLE KEYS */;
INSERT INTO `departments` VALUES (1,'Програмиране и ИТ','Програмиране, уеб технологии, бази данни, изкуствен интелект'),(2,'Математика и наука','Математика, статистика, логика и аналитично мислене'),(3,'Бизнес и маркетинг','Маркетинг, управление, електронна търговия и стратегии'),(5,'Езици','Курсове за изучаване на чужди езици и комуникация'),(6,'Кулинария и напитки','Кулинарни техники, домашни рецепти, ферментация и напитки'),(7,'Занаяти и умения','Практически умения, хобита, домашни занаяти и майсторство');
/*!40000 ALTER TABLE `departments` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-27 14:48:17
SET FOREIGN_KEY_CHECKS=1;
SET UNIQUE_CHECKS=1;
